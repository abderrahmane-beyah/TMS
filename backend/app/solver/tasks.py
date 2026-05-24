from celery import Celery
from app.config import settings
import psutil
import os

# ========== Coefficients Fonction Objectif (Équation 1.3) ==========
# Objectif multi-critères : min(α * Σ y_k + β * Σ Σ d_ij * x_ijk)
# où :
#   α (ALPHA) : coefficient pour le nombre de véhicules utilisés
#   β (BETA) : coefficient pour la distance totale parcourue (km)

ALPHA = 10000.0  # Coût par véhicule utilisé (valeur élevée = minimiser le nombre de véhicules)
BETA = 1.0       # Coût par kilomètre parcouru

# ========== Paramètres Heuristique Solomon I1 ==========
# Calcul du coût d'insertion : coût = ALPHA1 * c1 + ALPHA2 * c2
# Basé sur : Solomon, M. M. (1987). Operations Research, 35(2), 254-265

SOLOMON_ALPHA1 = 1.0   # Poids du coût de distance dans l'insertion
SOLOMON_ALPHA2 = 0.1   # Poids du coût d'urgence de fenêtre temporelle
SOLOMON_MU = 1.0       # Facteur de pénalité de détour (0 à 1)

celery_app = Celery(
    "tms",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_BROKER_URL,
)


def _run_multi_trip_optimization(
    commandes_data: list,
    vehicules_data: list,
    depot_lat: float,
    depot_lon: float,
    time_limit: int,
    date_str: str,
    db
) -> dict:
    """
    Optimisation multi-trajets : premier trajet avec tous les véhicules, puis second trajet
    avec les véhicules de retour pour les commandes non servies.
    """
    from app.solver.ortools_solver import ORToolsVRPTWSolver
    from datetime import datetime, time as time_obj

    print(f"[INFO] Démarrage de l'optimisation multi-trajets")

    # ========== Étape 1 : premier trajet avec solutions partielles ==========
    solver_phase1 = ORToolsVRPTWSolver(
        commandes_data,
        vehicules_data,
        depot_lat=depot_lat,
        depot_lon=depot_lon,
        alpha=ALPHA,
        beta=BETA
    )
    solution_phase1 = solver_phase1.solve(time_limit_seconds=time_limit, allow_partial=True)

    if not solution_phase1:
        print("[ERREUR] Phase 1 échouée - aucune solution même avec le mode partiel activé")
        return None

    # Vérifier s'il y a des commandes non servies
    unserved = solution_phase1.get('commandes_non_servies', [])

    if not unserved:
        print(f"[INFO] Phase 1 a servi toutes les {len(commandes_data)} commandes - pas de second trajet nécessaire")
        return solution_phase1

    print(f"[INFO] Phase 1: {len(solution_phase1['tournees'])} itinéraires, {len(unserved)} commandes non servies")

    # ========== Étape 2 : second trajet avec véhicules de retour ==========

    # Temps de chargement / rechargement (delta) : décharger les retours,
    # recharger le lot suivant, pause chauffeur. C'est la MÊME opération
    # physique au quai que le chargement du premier trajet, donc on utilise
    # la même valeur configurable DEPOT_LOAD_MINUTES (et non plus un
    # paramètre "rechargement" séparé). Le départ du second trajet d'un véhicule
    # est son heure de retour PLUS ce delta.
    reload_seconds = int(settings.DEPOT_LOAD_MINUTES) * 60

    # Heures de retour par véhicule issues de l'étape 1.
    routes_with_return = [(r['vehicule_id'], r['heure_retour_depot']) for r in solution_phase1['tournees']]
    routes_with_return.sort(key=lambda x: x[1])  # retour le plus tôt en premier

    print(f"[INFO] Heures de retour des véhicules: {routes_with_return}")
    print(f"[INFO] Temps de chargement (delta): {reload_seconds // 60} min")

    if not routes_with_return:
        print("[INFO] Aucun itinéraire en phase 1 - impossible de faire un second trajet")
        return solution_phase1

    # Utiliser la MÊME fermeture de dépôt que le solveur (configuration),
    # pas une valeur codée en dur, pour que le filtre et le solveur soient
    # d'accord sur l'horizon de la journée.
    depot_close_seconds = settings.DEPOT_CLOSE_HOUR * 3600

    SERVICE_TIME = 600  # 10 min de service ; doit correspondre à la fonction de rappel de temps du solveur

    # Calculer pour chaque véhicule son heure de DISPONIBILITÉ = retour +
    # delta. C'est le plus tôt où il peut réellement repartir (second
    # trajet), une fois rechargé.
    vehicle_ready = {}  # vehicule_id -> ready_seconds
    for vehicule_id, return_time in routes_with_return:
        ret_hour, ret_min, _ = map(int, return_time.split(':'))
        ret_seconds = ret_hour * 3600 + ret_min * 60
        vehicle_ready[vehicule_id] = ret_seconds + reload_seconds
    # Médiane des heures de disponibilité (retour + delta) de tous les
    # véhicules. Sert de référence pour exclure les véhicules trop en retard
    # sur le groupe : un véhicule prêt plus d'1h après la médiane est
    # désynchronisé de la flotte et exclu du second trajet.
    ready_times = sorted(vehicle_ready.values())
    n = len(ready_times)
    if n % 2 == 1:
        median_ready = ready_times[n // 2]
    else:
        median_ready = (ready_times[n // 2 - 1] + ready_times[n // 2]) / 2
    median_cutoff = median_ready + 3600  # médiane + 1h
    # Véhicules disponibles pour un second trajet : prêts avec assez de
    # journée restante pour un trajet utile (au moins ~1h avant la
    # fermeture du dépôt).
    available_for_second_trip = []
    for vehicule_id, _ in routes_with_return:
        # Éligible seulement si : (a) assez de journée restante (>= 1h avant
        # fermeture) ET (b) pas trop en retard sur le groupe (<= médiane + 1h).
        # Exclu si l'une des deux conditions échoue (OU logique pour l'exclusion).
        if (vehicle_ready[vehicule_id] < depot_close_seconds - 3600
                and vehicle_ready[vehicule_id] <= median_cutoff):
            vehicule = next(v for v in vehicules_data if v['id'] == vehicule_id)
            available_for_second_trip.append(vehicule)

    if not available_for_second_trip:
        print(f"[INFO] Aucun véhicule disponible pour un second trajet "
              f"(tous prêts trop tard après {reload_seconds // 60} min de chargement)")
        return solution_phase1

    # Le plus tôt où un camion disponible peut partir (sert au filtre
    # d'atteignabilité : une commande est candidate si AU MOINS UN camion
    # disponible peut l'atteindre à temps).
    earliest_ready_seconds = min(
        vehicle_ready[v['id']] for v in available_for_second_trip
    )
    print(f"[INFO] Départ du second trajet au plus tôt (chargement inclus): "
          f"{earliest_ready_seconds // 3600:02d}:"
          f"{(earliest_ready_seconds % 3600) // 60:02d}")

    # Réutiliser le service de routage pour de vrais temps de trajet
    # dépôt -> client.
    from app.services.routing_service import get_routing_service
    routing_service = get_routing_service(backend=settings.ROUTING_BACKEND)

    # Filtrer les commandes non servies atteignables sur un second trajet :
    # en partant à l'heure de disponibilité la plus tôt, rouler jusqu'au
    # client, arriver (plus le service) dans la fenêtre, et revenir avant la
    # fermeture du dépôt.
    feasible_unserved = []
    for unserved_info in unserved:
        commande_id = unserved_info['commande_id']
        commande = next((c for c in commandes_data if c['id'] == commande_id), None)
        if not commande:
            continue

        closing_seconds = (commande['heure_fermeture'].hour * 3600
                           + commande['heure_fermeture'].minute * 60)

        locs = [(depot_lat, depot_lon),
                (commande['lat_livraison'], commande['lon_livraison'])]
        _, time_mat = routing_service.build_matrix(locs)
        travel_out = time_mat[0][1]
        travel_back = time_mat[1][0]

        arrival = earliest_ready_seconds + travel_out
        if arrival > closing_seconds:
            continue  # la fenêtre ferme avant qu'un camion puisse arriver
        if arrival + SERVICE_TIME + travel_back > depot_close_seconds:
            continue  # l'aller-retour ne finirait pas avant la fermeture du dépôt

        feasible_unserved.append(commande)

    if not feasible_unserved:
        print(f"[INFO] Aucune commande non servie atteignable sur un second "
              f"trajet (départ au plus tôt {earliest_ready_seconds // 3600:02d}:"
              f"{(earliest_ready_seconds % 3600) // 60:02d}) - arrêt")
        return solution_phase1

    print(f"[INFO] Phase 2: {len(feasible_unserved)} commandes atteignables sur un second trajet")
    print(f"[INFO] Phase 2: {len(available_for_second_trip)} véhicules utilisés pour le second trajet")

    # Construire les planchers de départ par véhicule dans le MÊME ordre que
    # les véhicules passés au solveur, pour que chaque camion soit contraint
    # par sa propre heure de disponibilité (retour + delta).
    departure_floors = [vehicle_ready[v['id']] for v in available_for_second_trip]

    # Lancer la seconde optimisation. CRITIQUE : chaque camion ne peut pas
    # partir avant son propre (retour + delta). Passer des planchers par
    # véhicule garde le plan exécutable (aucun camion ne "part" avant d'être
    # revenu et rechargé) et les heures d'arrivée rapportées honnêtes.
    solver_phase2 = ORToolsVRPTWSolver(
        feasible_unserved,
        available_for_second_trip,
        depot_lat=depot_lat,
        depot_lon=depot_lon,
        alpha=ALPHA,
        beta=BETA
    )

    # Limite de temps plus courte pour la seconde étape.
    solution_phase2 = solver_phase2.solve(
        time_limit_seconds=min(time_limit, 60),
        allow_partial=True,
        earliest_departure_per_vehicle=departure_floors,
    )

    if not solution_phase2 or not solution_phase2.get('tournees'):
        print(f"[INFO] Phase 2 n'a trouvé aucun itinéraire supplémentaire")
        return solution_phase1

    # ========== Combiner les deux solutions ==========
    print(f"[INFO] Phase 2: {len(solution_phase2['tournees'])} itinéraires supplémentaires")

    combined_tournees = solution_phase1['tournees'] + solution_phase2['tournees']
    combined_distance = solution_phase1['distance_totale'] + solution_phase2['distance_totale']
    combined_vehicles = len(set(r['vehicule_id'] for r in combined_tournees))

    # Comptabilisation correcte des commandes non servies : une commande est non
    # servie si elle n'apparaît dans AUCUN itinéraire des deux phases. On ne peut
    # pas simplement prendre les restes de l'étape 2, car les commandes abandonnées
    # à l'étape 1 puis exclues par le filtre de faisabilité (inatteignables sur un
    # second trajet) ne sont servies par aucune étape mais seraient autrement non comptées.
    served_ids = set()
    for route in combined_tournees:
        for stop in route['stops']:
            served_ids.add(stop['commande_id'])

    combined_unserved = [
        {'commande_id': c['id'],
         'raison': 'Non servie (capacité ou fenêtre temporelle sur les deux tournées)'}
        for c in commandes_data if c['id'] not in served_ids
    ]

    final_solution = {
        'tournees': combined_tournees,
        'distance_totale': round(combined_distance, 2),
        'nb_vehicules_utilises': combined_vehicles,
        'nb_commandes_non_servies': len(combined_unserved),
        'commandes_non_servies': combined_unserved,
        'algorithme': 'OR_TOOLS_MULTI_TRIP'
    }

    print(f"[INFO] Multi-trajets terminé: {len(combined_tournees)} itinéraires au total, "
          f"{len(combined_unserved)} toujours non servies")

    return final_solution


@celery_app.task(name="tms.run_optimisation", bind=True)
def run_optimisation(self, tache_id: int, warehouse_id: int, commande_ids: list, vehicule_ids: list, date_str: str):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.optimisation import TacheOptimisation
    from app.models.commande import Commande
    from app.models.vehicule import Vehicule
    from app.models.warehouse import Warehouse
    from app.models.tournee import Tournee, StopTournee
    from app.models.enums import StatutTacheEnum, AlgorithmeEnum, StatutTourneeEnum, StatutStopEnum, StatutCommandeEnum
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
            # Analyser la date d'abord pour validation
            date_execution = datetime.strptime(date_str, "%Y-%m-%d").date()

            # Récupérer l'entrepôt pour les coordonnées du dépôt
            warehouse = db.get(Warehouse, warehouse_id)
            if not warehouse:
                raise ValueError(f"Entrepôt {warehouse_id} introuvable")

            depot_lat = warehouse.lat
            depot_lon = warehouse.lon

            # Récupérer les commandes - exclure les livrées et annulées
            commandes = db.query(Commande).filter(
                Commande.id.in_(commande_ids),
                Commande.statut.in_([
                    StatutCommandeEnum.EN_ATTENTE,
                    StatutCommandeEnum.AFFECTEE  # Permettre la ré-optimisation des commandes affectées
                ])
            ).all()
            if not commandes:
                raise ValueError("Aucune commande trouvée (ou toutes sont livrées/annulées)")

            # Valider que toutes les commandes ont la même date de livraison que la date d'optimisation
            invalid_dates = [c for c in commandes if c.date_livraison != date_execution]
            if invalid_dates:
                raise ValueError(
                    f"Toutes les commandes doivent avoir la date de livraison {date_execution}. "
                    f"{len(invalid_dates)} commande(s) ont des dates différentes."
                )

            # Vérifier si ré-optimisation: des tournées existent déjà pour cette date?
            existing_tournees = db.query(Tournee).filter(
                Tournee.date == date_execution,
                Tournee.warehouse_id == warehouse_id
            ).all()

            if existing_tournees:
                # Ré-optimisation: vérifier s'il y a de NOUVELLES commandes (EN_ATTENTE)
                new_commandes = [c for c in commandes if c.statut == StatutCommandeEnum.EN_ATTENTE]
                if not new_commandes:
                    raise ValueError(
                        f"Aucune nouvelle commande pour le {date_execution}. "
                        "La ré-optimisation n'est autorisée que si de nouvelles commandes ont été ajoutées."
                    )

                # Supprimer les anciennes tournées PLANIFIEE (pas encore commencées) pour les remplacer
                planifiee_tournees = [t for t in existing_tournees if t.statut == StatutTourneeEnum.PLANIFIEE]
                for tournee in planifiee_tournees:
                    # Supprimer également les arrêts associés
                    db.query(StopTournee).filter(StopTournee.tournee_id == tournee.id).delete()
                    db.delete(tournee)
                db.commit()

                print(f"Ré-optimisation: {len(planifiee_tournees)} tournée(s) planifiée(s) supprimée(s), "
                      f"{len(new_commandes)} nouvelle(s) commande(s) ajoutée(s)")

            tache.progression = 20
            db.commit()

            # Récupérer les véhicules
            vehicules = db.query(Vehicule).filter(Vehicule.id.in_(vehicule_ids)).all()
            if not vehicules:
                raise ValueError("Aucun véhicule trouvé")

            tache.progression = 30
            db.commit()

            # Obtenir les chauffeurs disponibles AVANT l'optimisation pour limiter le nombre de véhicules
            from app.models.utilisateur import Utilisateur

            available_chauffeurs = db.query(Utilisateur).filter(
                Utilisateur.role == 'CHAUFFEUR',
                Utilisateur.statut == 'DISPONIBLE',
                Utilisateur.warehouse_id == warehouse_id
            ).all()

            if not available_chauffeurs:
                raise ValueError(f"Aucun chauffeur disponible dans l'entrepôt {warehouse.nom}. Veuillez vous assurer qu'au moins un chauffeur est disponible.")

            # Limiter les véhicules au nombre de chauffeurs disponibles
            # (un chauffeur ne peut conduire qu'un véhicule à la fois)
            max_vehicles = min(len(vehicules), len(available_chauffeurs))

            # Trier les véhicules par capacité (décroissante) pour sélectionner d'abord les plus grands
            # Cela maximise la capacité totale disponible pour l'optimisation
            vehicules_sorted = sorted(
                vehicules,
                key=lambda v: (v.capacite_poids + v.capacite_volume * 100),  # Métrique de capacité combinée
                reverse=True  # Les plus grands en premier
            )
            vehicules_to_use = vehicules_sorted[:max_vehicles]

            if len(vehicules) > len(available_chauffeurs):
                selected_ids = [v.id for v in vehicules_to_use]
                print(f"Avertissement: {len(vehicules)} véhicules mais seulement {len(available_chauffeurs)} chauffeurs disponibles.")
                print(f"   Sélectionné {max_vehicles} véhicules avec la plus grande capacité: {selected_ids}")

            # Conversion en dictionnaires pour le solveur.
            # NB : selon la version de SQLAlchemy, une colonne SAEnum peut
            # être désérialisée soit en membre d'enum (avec .value), soit
            # directement en chaîne. On gère les deux cas via getattr pour
            # éviter toute erreur d'attribut.
            def _enum_str(val, default=None):
                if val is None:
                    return default
                return getattr(val, 'value', val)  # membre d'enum -> .value, sinon la chaîne

            commandes_data = [{
                'id': c.id,
                'adresse_livraison': c.adresse_livraison,
                'lat_livraison': c.lat_livraison,
                'lon_livraison': c.lon_livraison,
                'poids': c.poids,
                'volume': c.volume,
                'heure_ouverture': c.heure_ouverture,
                'heure_fermeture': c.heure_fermeture,
                'type_vehicule_requis': _enum_str(c.type_vehicule_requis, None),
                'time_window_type': _enum_str(c.time_window_type, 'HARD'),
            } for c in commandes]

            vehicules_data = [{
                'id': v.id,
                'immatriculation': v.immatriculation,
                'capacite_poids': v.capacite_poids,
                'capacite_volume': v.capacite_volume,
                # Type du véhicule ; 'NORMAL' par défaut.
                'type_vehicule': _enum_str(v.type_vehicule, 'NORMAL'),
            } for v in vehicules_to_use]  # véhicules limités

            tache.progression = 40
            db.commit()

            # Sélectionner le solveur en fonction de l'algorithme et suivre les ressources
            process = psutil.Process(os.getpid())

            # Capturer l'état initial
            start_time = time_module.time()
            start_cpu_times = process.cpu_times()
            start_memory = process.memory_info().rss / 1024 / 1024  # Mo

            if tache.algorithme == AlgorithmeEnum.OR_TOOLS:
                # Limite de temps dynamique basée sur la taille du problème
                # Petits problèmes (< 20 commandes): 30s
                # Problèmes moyens (20-50 commandes): 60s
                # Grands problèmes (> 50 commandes): 120s
                num_commandes = len(commandes_data)
                if num_commandes < 20:
                    time_limit = 30
                elif num_commandes < 50:
                    time_limit = 60
                else:
                    time_limit = 120

                print(f"[INFO] Utilisation d'une limite de temps de {time_limit}s pour {num_commandes} commandes")

                # Essayer l'optimisation multi-trajets pour les grands problèmes
                solution = _run_multi_trip_optimization(
                    commandes_data,
                    vehicules_data,
                    depot_lat,
                    depot_lon,
                    time_limit,
                    date_str,
                    db
                )
            else:  # HEURISTIQUE (Solomon I1 avec améliorations)
                solver = HeuristicVRPTWSolver(
                    commandes_data,
                    vehicules_data,
                    depot_lat=depot_lat,
                    depot_lon=depot_lon,
                    alpha1=SOLOMON_ALPHA1,
                    alpha2=SOLOMON_ALPHA2,
                    mu=SOLOMON_MU
                )
                # Utiliser multi-démarrage avec insertion basée sur le regret pour de meilleurs résultats
                solution = solver.solve(multi_start=True)

            # Capturer l'état final et calculer l'usage des ressources
            end_time = time_module.time()
            end_cpu_times = process.cpu_times()
            end_memory = process.memory_info().rss / 1024 / 1024  # Mo

            temps_execution = end_time - start_time

            # Calculer le pourcentage d'utilisation du CPU
            cpu_time_used = (end_cpu_times.user - start_cpu_times.user) + \
                           (end_cpu_times.system - start_cpu_times.system)
            cpu_usage_percent = (cpu_time_used / temps_execution) * 100 if temps_execution > 0 else 0

            # Utilisation de la mémoire (pic pendant l'exécution)
            memory_usage_mb = max(end_memory - start_memory, 0)

            if not solution:
                # Calculer les métriques du problème pour le message d'erreur
                total_poids = sum(c['poids'] for c in commandes_data)
                total_volume = sum(c['volume'] for c in commandes_data)
                fleet_poids = sum(v['capacite_poids'] for v in vehicules_data)
                fleet_volume = sum(v['capacite_volume'] for v in vehicules_data)

                error_msg = (
                    f"Aucune solution trouvée pour {len(commandes_data)} commandes et {len(vehicules_data)} véhicules. "
                    f"Demande totale: {total_poids:.0f}kg / {total_volume:.1f}m³. "
                    f"Capacité flotte: {fleet_poids:.0f}kg / {fleet_volume:.1f}m³. "
                )

                # Vérifier si la capacité est le problème
                if total_poids > fleet_poids or total_volume > fleet_volume:
                    error_msg += "CAPACITÉ INSUFFISANTE: La flotte ne peut pas transporter toutes les commandes. "
                    if total_poids > fleet_poids:
                        error_msg += f"Poids excédent: {total_poids - fleet_poids:.0f}kg. "
                    if total_volume > fleet_volume:
                        error_msg += f"Volume excédent: {total_volume - fleet_volume:.1f}m³. "
                    error_msg += "Ajoutez plus de véhicules ou réduisez le nombre de commandes."
                else:
                    error_msg += "Les contraintes de fenêtres de temps ou de distance sont probablement incompatibles. Essayez d'élargir les fenêtres de temps ou d'ajouter des véhicules."

                raise ValueError(error_msg)

            tache.progression = 70
            db.commit()

            # Créer les tournées dans la base de données (date_execution déjà analysée plus tôt).
            # Un véhicule peut maintenant avoir DEUX tournées (premier + deuxième trajet). Le
            # même chauffeur physique doit gérer les deux trajets d'un véhicule donné,
            # donc on assigne les chauffeurs par VÉHICULE (rotation circulaire sur les véhicules),
            # pas par tournée -- sinon le trajet 1 et le trajet 2 d'un camion
            # seraient donnés à des chauffeurs différents, ce qui est impossible.
            vehicule_to_chauffeur = {}
            next_chauffeur_index = 0

            for tournee_data in solution['tournees']:
                veh_id = tournee_data['vehicule_id']
                if veh_id not in vehicule_to_chauffeur:
                    vehicule_to_chauffeur[veh_id] = available_chauffeurs[
                        next_chauffeur_index % len(available_chauffeurs)
                    ]
                    next_chauffeur_index += 1
                assigned_chauffeur = vehicule_to_chauffeur[veh_id]

                # Analyser l'heure de départ prévue si disponible
                heure_depart_prevue = None
                if 'heure_depart_prevue' in tournee_data:
                    heure_depart_prevue = datetime.strptime(
                        f"{date_str} {tournee_data['heure_depart_prevue']}", "%Y-%m-%d %H:%M:%S"
                    )
                    heure_depart_prevue = heure_depart_prevue.replace(tzinfo=timezone.utc)

                tournee = Tournee(
                    vehicule_id=tournee_data['vehicule_id'],
                    chauffeur_id=assigned_chauffeur.id,
                    date=date_execution,
                    statut=StatutTourneeEnum.PLANIFIEE,
                    distance_totale=tournee_data['distance'],
                    heure_depart=heure_depart_prevue,  # Heure de départ prévue du solveur
                    depot_lat=depot_lat,  # Stocker les coordonnées de l'entrepôt comme dépôt
                    depot_lon=depot_lon,
                    warehouse_id=warehouse_id,
                    tache_optimisation_id=tache_id,  # Lien vers la tâche d'optimisation
                )
                db.add(tournee)
                db.flush()  # Obtenir tournee.id

                # Créer les arrêts
                for stop_data in tournee_data['stops']:
                    # Analyser l'heure d'arrivée comme objet date/heure avec fuseau horaire
                    heure_arrivee = datetime.strptime(
                        f"{date_str} {stop_data['heure_arrivee_prevue']}", "%Y-%m-%d %H:%M:%S"
                    )
                    # Ajouter le fuseau horaire (UTC)
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

                    # Mettre à jour le statut de la commande à AFFECTEE
                    commande = db.query(Commande).filter(Commande.id == stop_data['commande_id']).first()
                    if commande:
                        commande.statut = StatutCommandeEnum.AFFECTEE
                        commande.vehicule_id = tournee.vehicule_id
                        commande.chauffeur_id = tournee.chauffeur_id

            tache.progression = 90
            db.commit()

            # Mettre à jour la tâche avec les résultats et l'usage des ressources
            tache.statut = StatutTacheEnum.TERMINEE
            tache.progression = 100
            tache.distance_totale = solution['distance_totale']
            tache.nb_vehicules_utilises = solution['nb_vehicules_utilises']
            tache.nb_commandes_non_servies = solution['nb_commandes_non_servies']
            tache.resultat_json = solution
            tache.temps_execution = temps_execution
            tache.cpu_usage_percent = round(cpu_usage_percent, 2)
            tache.memory_usage_mb = round(memory_usage_mb, 2)
            tache.date_execution = datetime.now(timezone.utc)
            db.commit()

        except Exception as exc:
            tache.statut = StatutTacheEnum.ERREUR
            tache.resultat_json = {"erreur": str(exc)}
            tache.progression = 0
            db.commit()
            raise
