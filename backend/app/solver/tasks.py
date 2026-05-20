from celery import Celery
from app.config import settings

# ========== Objective Function Coefficients (Equation 1.3) ==========
# Multi-criteria objective: min(α * Σ y_k + β * Σ Σ d_ij * x_ijk)
# where:
#   α (ALPHA): coefficient for number of vehicles used
#   β (BETA): coefficient for total distance traveled (km)

ALPHA = 10000.0  # Cost per vehicle used (high value = minimize vehicle count)
BETA = 1.0       # Cost per kilometer traveled

# ========== Solomon I1 Heuristic Parameters ==========
# For insertion cost calculation: cost = ALPHA1 * c1 + ALPHA2 * c2
# Based on: Solomon, M. M. (1987). Operations Research, 35(2), 254-265

SOLOMON_ALPHA1 = 1.0   # Weight for distance cost in insertion
SOLOMON_ALPHA2 = 0.1   # Weight for time window urgency cost
SOLOMON_MU = 1.0       # Detour penalty factor (0 to 1)

celery_app = Celery(
    "tms",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_BROKER_URL,
)


@celery_app.task(name="tms.run_optimisation", bind=True)
def run_optimisation(self, tache_id: int, commande_ids: list, vehicule_ids: list, date_str: str):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.optimisation import TacheOptimisation
    from app.models.commande import Commande
    from app.models.vehicule import Vehicule
    from app.models.tournee import Tournee, StopTournee
    from app.models.enums import StatutTacheEnum, AlgorithmeEnum, StatutTourneeEnum, StatutStopEnum
    from app.solver.ortools_solver import ORToolsVRPTWSolver
    from app.solver.heuristic_solver import HeuristicVRPTWSolver
    from datetime import datetime, timezone, date
    import time as time_module

    sync_url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg2://"
    )
    engine = create_engine(sync_url)

    with Session(engine) as db:
        tache = db.get(TacheOptimisation, tache_id)
        if not tache:
            return

        tache.statut = StatutTacheEnum.EN_COURS
        tache.progression = 10
        db.commit()

        try:
            # Fetch commandes
            commandes = db.query(Commande).filter(Commande.id.in_(commande_ids)).all()
            if not commandes:
                raise ValueError("Aucune commande trouvée")

            tache.progression = 20
            db.commit()

            # Fetch vehicules
            vehicules = db.query(Vehicule).filter(Vehicule.id.in_(vehicule_ids)).all()
            if not vehicules:
                raise ValueError("Aucun véhicule trouvé")

            tache.progression = 30
            db.commit()

            # Convert to dictionaries
            commandes_data = [{
                'id': c.id,
                'adresse_livraison': c.adresse_livraison,
                'lat_livraison': c.lat_livraison,
                'lon_livraison': c.lon_livraison,
                'poids': c.poids,
                'volume': c.volume,
                'heure_ouverture': c.heure_ouverture,
                'heure_fermeture': c.heure_fermeture,
            } for c in commandes]

            vehicules_data = [{
                'id': v.id,
                'immatriculation': v.immatriculation,
                'capacite_poids': v.capacite_poids,
                'capacite_volume': v.capacite_volume,
            } for v in vehicules]

            tache.progression = 40
            db.commit()

            # Select solver based on algorithm
            start_time = time_module.time()

            if tache.algorithme == AlgorithmeEnum.OR_TOOLS:
                solver = ORToolsVRPTWSolver(
                    commandes_data,
                    vehicules_data,
                    alpha=ALPHA,
                    beta=BETA
                )
                solution = solver.solve(time_limit_seconds=30)
            else:  # HEURISTIQUE (Solomon I1)
                solver = HeuristicVRPTWSolver(
                    commandes_data,
                    vehicules_data,
                    alpha1=SOLOMON_ALPHA1,
                    alpha2=SOLOMON_ALPHA2,
                    mu=SOLOMON_MU
                )
                solution = solver.solve()

            end_time = time_module.time()
            temps_execution = end_time - start_time

            if not solution:
                raise ValueError("Aucune solution trouvée")

            tache.progression = 70
            db.commit()

            # Parse date
            date_execution = datetime.strptime(date_str, "%Y-%m-%d").date()

            # Create tournees in database
            # Get available chauffeurs
            from app.models.utilisateur import Utilisateur
            from app.models.vehicule import Vehicule

            available_chauffeurs = db.query(Utilisateur).filter(
                Utilisateur.role == 'CHAUFFEUR',
                Utilisateur.statut == 'DISPONIBLE'
            ).all()

            if not available_chauffeurs:
                raise ValueError("No available chauffeur found. Please ensure at least one driver is available.")

            # Assign chauffeurs to tournees (round-robin or by city)
            chauffeur_index = 0

            for tournee_data in solution['tournees']:
                # Get vehicle to check its city
                vehicule = db.query(Vehicule).filter(Vehicule.id == tournee_data['vehicule_id']).first()

                # Try to find chauffeur from same city, otherwise use round-robin
                assigned_chauffeur = None
                if vehicule and vehicule.ville:
                    # Find chauffeur from same city
                    for chauffeur in available_chauffeurs:
                        if chauffeur.ville == vehicule.ville:
                            assigned_chauffeur = chauffeur
                            break

                # Fallback to round-robin if no city match
                if not assigned_chauffeur:
                    assigned_chauffeur = available_chauffeurs[chauffeur_index % len(available_chauffeurs)]
                    chauffeur_index += 1

                tournee = Tournee(
                    vehicule_id=tournee_data['vehicule_id'],
                    chauffeur_id=assigned_chauffeur.id,  # Assign different chauffeur per route
                    date=date_execution,  # Field is 'date', not 'date_tournee'
                    statut=StatutTourneeEnum.PLANIFIEE,
                    distance_totale=tournee_data['distance'],
                )
                db.add(tournee)
                db.flush()  # Get tournee.id

                # Create stops
                for stop_data in tournee_data['stops']:
                    # Parse arrival time as datetime with timezone
                    heure_arrivee = datetime.strptime(
                        f"{date_str} {stop_data['heure_arrivee_prevue']}", "%Y-%m-%d %H:%M:%S"
                    )
                    # Add timezone (UTC)
                    heure_arrivee = heure_arrivee.replace(tzinfo=timezone.utc)

                    stop = StopTournee(
                        tournee_id=tournee.id,
                        commande_id=stop_data['commande_id'],
                        ordre=stop_data['ordre'],
                        adresse=stop_data['adresse'],
                        lat=stop_data['lat'],
                        lon=stop_data['lon'],
                        heure_arrivee_prevue=heure_arrivee,
                        statut=StatutStopEnum.EN_ATTENTE,
                    )
                    db.add(stop)

            tache.progression = 90
            db.commit()

            # Update task with results
            tache.statut = StatutTacheEnum.TERMINEE
            tache.progression = 100
            tache.distance_totale = solution['distance_totale']
            tache.nb_vehicules_utilises = solution['nb_vehicules_utilises']
            tache.nb_commandes_non_servies = solution['nb_commandes_non_servies']
            tache.resultat_json = solution
            tache.temps_execution = temps_execution
            tache.date_execution = datetime.now(timezone.utc)
            db.commit()

        except Exception as exc:
            tache.statut = StatutTacheEnum.ERREUR
            tache.resultat_json = {"erreur": str(exc)}
            tache.progression = 0
            db.commit()
            raise
