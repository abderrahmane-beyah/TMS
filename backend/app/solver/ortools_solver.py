"""
Solveur OR-Tools pour VRPTW (problème de tournées de véhicules avec fenêtres temporelles)
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import time
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from app.services.routing_service import get_routing_service
from app.config import settings


class ORToolsVRPTWSolver:
    """
    Solveur utilisant Google OR-Tools pour l'optimisation VRPTW
    Utilise le routage routier réel via OSRM ou Google Maps

    Fonction objectif (Équation 1.3): min(α * Σ y_k + β * Σ Σ d_ij * x_ijk)
    où:
        α (alpha): coefficient pour le nombre de véhicules utilisés
        β (beta): coefficient pour la distance totale parcourue
    """

    def __init__(
        self,
        commandes: List[Dict],
        vehicules: List[Dict],
        depot_lat: float = None,
        depot_lon: float = None,
        alpha: float = 10000.0,  # α: Coût par véhicule utilisé (défaut: 10000)
        beta: float = 1.0,       # β: Coût par km parcouru (défaut: 1.0)
    ):
        """
        Initialise le solveur OR-Tools

        Paramètres:
            commandes: Liste des dictionnaires de commandes
            vehicules: Liste des dictionnaires de véhicules
            depot_lat: Latitude du dépôt (par défaut depuis la config)
            depot_lon: Longitude du dépôt (par défaut depuis la config)
            alpha: Coefficient pour le coût d'utilisation des véhicules (Équation 1.3)
            beta: Coefficient pour le coût de distance (Équation 1.3)
        """
        self.commandes = commandes
        self.vehicules = vehicules
        self.depot_lat = depot_lat if depot_lat is not None else settings.DEPOT_LAT
        self.depot_lon = depot_lon if depot_lon is not None else settings.DEPOT_LON
        self.alpha = alpha  # Coût par véhicule
        self.beta = beta    # Coût par km

        # ----- Source unique de vérité pour l'échelle des coûts -----
        # OR-Tools nécessite des coûts entiers. Nous travaillons en "unités de coût" où
        # 1 km de distance réelle == COST_SCALE unités. CHAQUE terme de coût
        # (distance, coût fixe du véhicule, pénalité de disjonction) DOIT être
        # exprimé dans ces mêmes unités, sinon le solveur fera des
        # compromis absurdes (ex: abandonner toutes les commandes car la
        # pénalité d'abandon est moins chère que 200 m de conduite).
        self.COST_SCALE = 100  # 1 km -> 100 unités (précision 0.01 km)

        # Heures d'ouverture du dépôt (depuis la configuration)
        self.depot_close = settings.DEPOT_CLOSE_HOUR * 3600

        # Temps de chargement au dépôt (delta). Au lieu de modéliser le
        # chargement comme un temps de service sur le nœud dépôt (ce qui
        # interagit mal avec la dimension temporelle d'OR-Tools), on
        # décale l'heure d'ouverture vue par le solveur de delta : le
        # solveur "croit" que le dépôt ouvre à E + delta, donc aucun
        # véhicule ne peut partir avant d'avoir été chargé. Le plancher du
        # premier trajet a_0 >= E + delta est ainsi obtenu sans contrainte
        # supplémentaire. delta est configurable.
        self.depot_load_time = settings.DEPOT_LOAD_MINUTES * 60

        # Heure d'ouverture réelle du dépôt.
        depot_open_real = settings.DEPOT_OPEN_HOUR * 3600

        # Heure d'ouverture *effective* utilisée par le solveur = ouverture
        # réelle + temps de chargement. C'est la seule valeur que voit le
        # modèle ; tout le reste du code continue d'utiliser self.depot_open.
        self.depot_open = depot_open_real + self.depot_load_time

        # Obtenir le service de routage
        self.routing_service = get_routing_service(backend=settings.ROUTING_BACKEND)

        # Nombre d'emplacements (dépôt + emplacements de livraison)
        self.num_locations = 1 + len(commandes)
        self.num_vehicles = len(vehicules)

        # Construire les structures de données en utilisant le routage réel
        self._build_matrices()
        self.time_windows = self._build_time_windows()
        self.demands = self._build_demands()
        self.vehicle_capacities = self._build_vehicle_capacities()

    def _build_matrices(self):
        """
        Construit les matrices de distance et de temps en utilisant le routage routier réel
        """
        # Construire la liste des emplacements
        locations = [(self.depot_lat, self.depot_lon)]
        for cmd in self.commandes:
            locations.append((cmd['lat_livraison'], cmd['lon_livraison']))

        # Obtenir les matrices de distance et de temps réelles depuis le service de routage
        distance_matrix_km, time_matrix_sec = self.routing_service.build_matrix(locations)

        # Convertir les distances (km) en unités de coût entières en utilisant l'échelle
        # UNIQUE partagée. 1 km -> COST_SCALE unités. Remarque : beta est appliqué
        # plus tard dans la fonction de rappel de coût d'arc, NON intégré ici, donc la
        # distance brute est également réutilisée pour les rapports en km.
        self.distance_matrix = [
            [int(round(dist * self.COST_SCALE)) for dist in row]
            for row in distance_matrix_km
        ]

        # Temps: déjà en secondes, convertir en int
        self.time_matrix = [
            [int(t) for t in row]
            for row in time_matrix_sec
        ]

    def _time_to_seconds(self, t: time) -> int:
        """Convertit le temps en secondes depuis minuit"""
        return int(t.hour * 3600 + t.minute * 60 + t.second)

    def _build_time_windows(self) -> List[Tuple[int, int]]:
        """
        Construit les fenêtres temporelles de chaque emplacement.
        Retourne une liste de tuples (au_plus_tot, au_plus_tard) en secondes
        depuis minuit. La borne supérieure renvoyée est la fenêtre
        PRÉFÉRÉE (l_i) ; pour une commande à fenêtre souple, l'extension de
        tolérance (l_i + g) est appliquée plus tard, au moment du SetRange.

        Construit aussi self.time_window_types : 'hard' ou 'soft' par
        commande (le dépôt est toujours 'hard'), lu depuis le champ
        'time_window_type' de chaque commande, 'hard' par défaut.
        """
        # Fenêtre temporelle du dépôt (issue de la configuration).
        # self.depot_open vaut déjà E + delta (ouverture + chargement).
        windows = [(self.depot_open, self.depot_close)]
        self.time_window_types = ['hard']  # le dépôt est toujours dur

        for cmd in self.commandes:
            start = int(self._time_to_seconds(cmd['heure_ouverture']))
            end = int(self._time_to_seconds(cmd['heure_fermeture']))

            # Type de fenêtre : 'hard' (par défaut) ou 'soft'. Une valeur
            # inconnue est traitée comme 'hard' par sécurité.
            tw_type = str(cmd.get('time_window_type', 'hard')).lower()
            if tw_type not in ('hard', 'soft'):
                tw_type = 'hard'

            # Un véhicule ne peut pas partir avant l'ouverture effective du
            # dépôt (E + delta), donc une fenêtre client qui ouvre plus tôt
            # est ramenée à cette ouverture effective : le client ne peut de
            # toute façon pas être servi avant qu'un camion ait pu être
            # chargé et parti.
            if start < self.depot_open:
                start = self.depot_open

            # Après ce recalage, la fenêtre peut être devenue vide
            # (start > end) ou être mal formée dans les données source. On
            # re-valide APRÈS le recalage, pas avant : sinon on enverrait un
            # SetRange(start, end) infaisable avec start > end et tout le
            # modèle deviendrait ROUTING_INVALID sans cause claire.
            if end <= start:
                # Le client ne peut pas être servi dans les heures du dépôt
                # compte tenu du recalage. On ouvre sa fenêtre jusqu'à la
                # fermeture du dépôt pour que le solveur puisse quand même
                # l'envisager (ou l'abandonner via disjonction si partiel).
                end = self.depot_close

            # Garde-fou final : ne jamais passer une fenêtre inversée à
            # OR-Tools.
            if end < start:
                start, end = self.depot_open, self.depot_close

            windows.append((start, end))
            self.time_window_types.append(tw_type)

        return windows

    def _build_demands(self) -> List[Dict[str, float]]:
        """
        Construit la demande pour chaque emplacement (poids et volume)
        """
        demands = [{'poids': 0, 'volume': 0}]  # Le dépôt n'a pas de demande

        for cmd in self.commandes:
            demands.append({
                'poids': cmd['poids'],
                'volume': cmd['volume']
            })

        return demands

    def _build_vehicle_capacities(self) -> List[Dict[str, float]]:
        """
        Construit les contraintes de capacité pour chaque véhicule
        """
        capacities = []
        for veh in self.vehicules:
            capacities.append({
                'poids': veh['capacite_poids'],
                'volume': veh['capacite_volume']
            })

        return capacities

    def _calculate_earliest_meaningful_departure(self) -> int:
        """
        Calcule l'heure de départ significative la plus tôt depuis le dépôt.
        Approche juste-à-temps: le plus tard possible tout en atteignant tous les clients.

        Retour:
            Heure de départ significative la plus tôt en secondes
        """
        # PROBLÈME: Définir une seule heure de départ pour TOUS les véhicules est trop restrictif!
        # Différents itinéraires servent différents clients avec différentes fenêtres temporelles.
        # OR-Tools a besoin de flexibilité pour choisir différentes heures de départ par véhicule.

        # SOLUTION: Utiliser l'heure d'ouverture du dépôt (permettre la flexibilité)
        # Nous calculerons le départ juste-à-temps APRÈS la résolution, pas avant

        depot_open = self.time_windows[0][0]

        print(f"[DEBUG] Autorisation de départ flexible à partir de {depot_open // 3600:02d}:{(depot_open % 3600) // 60:02d}")
        print(f"[DEBUG] Le juste-à-temps sera calculé à partir de la solution (non contraint)")

        return int(depot_open)

    def solve(
        self,
        time_limit_seconds: int = 30,
        allow_partial: bool = False,
        earliest_departure_seconds: Optional[int] = None,
        earliest_departure_per_vehicle: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Résout le problème VRPTW

        Paramètres:
            time_limit_seconds: Temps maximum à consacrer à la résolution
            allow_partial: Si True, les commandes peuvent être abandonnées avec une pénalité
            earliest_departure_seconds: Si défini, TOUS les véhicules partagent cette
                heure de départ la plus tôt unique (secondes depuis minuit).
            earliest_departure_per_vehicle: Si défini, une liste par véhicule des
                heures de départ les plus tôt (secondes depuis minuit), une entrée
                par véhicule dans le même ordre que self.vehicules. Utilisé pour
                la planification multi-trajets afin que le deuxième trajet de chaque camion commence à
                SON PROPRE temps de retour plus rechargement, pas une valeur globale partagée.
                A la priorité sur earliest_departure_seconds.
                Lorsque les deux sont None, l'heure d'ouverture du dépôt est utilisée pour tous
                les véhicules (comportement mono-trajet).

        Retour:
            Dictionnaire de solution avec itinéraires et métriques, ou None si aucune solution
        """
        print(f"[DEBUG] Résolution VRPTW avec {self.num_locations} emplacements, {self.num_vehicles} véhicules")
        print(f"[DEBUG] Fenêtres temporelles: {self.time_windows[:5]}...")  # Afficher les 5 premiers

        # ========== Pénalité partagée et paramètres des fenêtres souples ==========
        # On calcule ici (avant la pose des fenêtres) la pénalité P en unités
        # de coût, car elle sert à DEUX endroits qui doivent rester cohérents :
        #   - la disjonction (abandon d'une commande), plus bas ;
        #   - le coût de retard des fenêtres SOUPLES (ci-dessous).
        # P doit dépasser le coût fixe d'un véhicule pour que servir soit
        # toujours préféré à abandonner quand c'est faisable (cf. modèle).
        fixed_vehicle_cost = int(round(self.alpha * self.COST_SCALE))
        self._penalty_scaled = fixed_vehicle_cost + int(round(1000 * self.COST_SCALE))

        # Période de grâce g (secondes) : retard maximal toléré sur une
        # fenêtre souple avant que la commande ne puisse plus être servie
        # qu'en l'abandonnant. Configurable.
        self._soft_grace = int(settings.SOFT_WINDOW_GRACE_MINUTES) * 60

        # Pente de retard gamma = P / g (coût par seconde de retard) : être
        # en retard de toute la période de grâce coûte ~ P, donc l'ordre de
        # préférence est : à l'heure < légèrement en retard < très en retard
        # < abandon. On garde au moins 1 pour éviter un coefficient nul.
        self._lateness_coeff = max(1, self._penalty_scaled // max(1, self._soft_grace))

        # Créer le gestionnaire d'index de routage
        manager = pywrapcp.RoutingIndexManager(
            self.num_locations,
            self.num_vehicles,
            0  # Index du dépôt
        )

        # Créer le modèle de routage
        routing = pywrapcp.RoutingModel(manager)

        # ========== Fonction de rappel de distance (mise à l'échelle par β) ==========
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            # distance_matrix est déjà en unités de coût (km * COST_SCALE).
            # Appliquer le coefficient beta pour le terme de distance de
            # l'objectif. Le résultat reste dans l'espace des unités de coût partagées.
            return int(round(self.distance_matrix[from_node][to_node] * self.beta))

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # ========== Coût fixe du véhicule (coefficient α) ==========
        # Objectif (Éq 1.3): min(alpha * véhicules_utilisés + beta * distance_km)
        # alpha est exprimé en "équivalents-km": utiliser un véhicule supplémentaire
        # coûte autant que parcourir alpha km. Pour le mettre dans les unités de coût
        # partagées, nous multiplions par le MÊME COST_SCALE utilisé pour la distance.
        # (Auparavant, cela utilisait 1000*100, qui sur-échelle de 1000x et
        #  ne semblait correct que parce que alpha était par défaut 10000.)
        fixed_vehicle_cost = int(round(self.alpha * self.COST_SCALE))
        routing.SetFixedCostOfAllVehicles(fixed_vehicle_cost)

        # ========== Fonction de rappel de temps (avec temps de service) ==========
        def time_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            travel_time = self.time_matrix[from_node][to_node]

            # Ajouter le temps de service au nœud source (10 minutes pour les clients, 0 pour le dépôt)
            service_time = 0 if from_node == 0 else 600  # 600 secondes = 10 minutes

            return travel_time + service_time

        time_callback_index = routing.RegisterTransitCallback(time_callback)

        # Ajouter la dimension temporelle.
        time_dimension_name = 'Time'

        # IMPORTANT : la valeur cumulative de cette dimension est le temps d'horloge
        # absolu (secondes depuis minuit), car le départ du dépôt et toutes
        # les fenêtres clients sont des temps absolus. Par conséquent, la
        # "capacité" de la dimension doit être le dernier temps absolu autorisé -- dépôt
        # FERMÉ -- pas la *durée* de l'itinéraire.
        #
        # Le code précédent utilisait (depot_close - depot_open) comme plafond,
        # ce qui tronquait silencieusement chaque itinéraire à depot_open + cette durée.
        # Avec un départ tôt, cela semblait correct, mais un départ tardif (deuxième trajet)
        # ne laissait presque aucune marge et le solveur abandonnait toutes
        # les commandes. Utiliser depot_close comme plafond corrige les cas mono- et
        # multi-trajets.
        max_cumulative_time = self.time_windows[0][1]  # fermeture du dépôt (abs.)

        routing.AddDimension(
            time_callback_index,
            7200,  # marge: jusqu'à 2h d'attente à un nœud pour une arrivée précoce
            max_cumulative_time,  # plafond = dernier temps absolu (fermeture du dépôt)
            False,  # Ne pas forcer le cumul de départ à zéro (départ = heure de départ)
            time_dimension_name
        )
        time_dimension = routing.GetDimensionOrDie(time_dimension_name)

        # ========== Contraintes de fenêtres temporelles (dures / souples) ==========
        # Pour chaque commande :
        #   - fenêtre DURE  : SetRange(e_i, l_i). Le service ne peut PAS
        #     commencer après l_i ; si infaisable, la commande est abandonnée.
        #   - fenêtre SOUPLE: on autorise le service jusqu'à l_i + g via
        #     SetRange(e_i, l_i + g), puis on pénalise tout retard au-delà de
        #     l_i avec SetCumulVarSoftUpperBound(l_i, gamma). Le coût de
        #     retard est gamma par seconde, calibré pour qu'un retard égal à
        #     g coûte ~ P (la pénalité d'abandon) : ainsi le solveur sert à
        #     l'heure si possible, accepte un léger retard plutôt que
        #     d'abandonner, et n'abandonne que si le retard dépasse g.
        depot_close_abs = int(self.time_windows[0][1])
        n_soft = 0
        for location_idx, (earliest, latest) in enumerate(self.time_windows):
            if location_idx == 0:
                continue  # on saute le dépôt
            index = manager.NodeToIndex(location_idx)
            earliest_int = int(earliest)
            latest_int = int(latest)
            tw_type = self.time_window_types[location_idx]

            try:
                if tw_type == 'soft':
                    # Borne supérieure étendue à l_i + g (bornée par la
                    # fermeture du dépôt : on ne sert jamais après fermeture).
                    extended_latest = min(latest_int + self._soft_grace, depot_close_abs)
                    # Si l'extension dépasse déjà la fermeture, extended_latest
                    # peut être <= earliest dans des cas extrêmes ; on garde
                    # alors une fenêtre dure cohérente.
                    if extended_latest < earliest_int:
                        extended_latest = earliest_int
                    time_dimension.CumulVar(index).SetRange(earliest_int, extended_latest)
                    # Pénalité de retard au-delà de la borne préférée l_i.
                    time_dimension.SetCumulVarSoftUpperBound(
                        index, latest_int, self._lateness_coeff
                    )
                    n_soft += 1
                else:
                    # Fenêtre dure classique.
                    time_dimension.CumulVar(index).SetRange(earliest_int, latest_int)
            except Exception as e:
                print(f"[ERREUR] Échec de pose de la fenêtre pour l'emplacement "
                      f"{location_idx} (type={tw_type}): [{earliest_int}, {latest_int}]")
                print(f"[ERREUR] {e}")
                raise

        if n_soft > 0:
            print(f"[INFO] Fenêtres souples: {n_soft} commande(s), "
                  f"grâce {self._soft_grace // 60} min, "
                  f"coût de retard {self._lateness_coeff} unités/s")

        # Ajouter la fenêtre temporelle pour le dépôt (début et fin)
        depot_idx = manager.NodeToIndex(0)
        time_dimension.CumulVar(depot_idx).SetRange(
            self.time_windows[0][0],
            self.time_windows[0][1]
        )

        # Instancier les heures de départ des itinéraires. Chaque véhicule obtient son propre plancher
        # de départ le plus tôt:
        #   - trajet simple            -> ouverture du dépôt pour tous les véhicules
        #   - deuxième trajet multi-trajets -> retour propre de chaque camion + rechargement
        # Nous construisons une liste par véhicule de planchers quoi qu'il arrive, donc les chemins
        # simple et multi-trajets partagent un seul chemin de code ci-dessous.
        depot_open = self.time_windows[0][0]
        depot_close = self.time_windows[0][1]

        if earliest_departure_per_vehicle is not None:
            if len(earliest_departure_per_vehicle) != self.num_vehicles:
                print(f"[ERREUR] earliest_departure_per_vehicle a "
                      f"{len(earliest_departure_per_vehicle)} entrées mais il y a "
                      f"{self.num_vehicles} véhicules.")
                return None
            departure_floors = [int(t) for t in earliest_departure_per_vehicle]
            print(f"[DEBUG] Planchers de départ par véhicule (multi-trajet): "
                  + ", ".join(
                      f"{self.vehicules[v]['id']}@"
                      f"{departure_floors[v] // 3600:02d}:"
                      f"{(departure_floors[v] % 3600) // 60:02d}"
                      for v in range(self.num_vehicles)))
        elif earliest_departure_seconds is not None:
            floor = int(earliest_departure_seconds)
            departure_floors = [floor] * self.num_vehicles
            print(f"[DEBUG] Plancher de départ partagé (multi-trajet): "
                  f"{floor // 3600:02d}:{(floor % 3600) // 60:02d}")
        else:
            floor = self._calculate_earliest_meaningful_departure()
            departure_floors = [floor] * self.num_vehicles

        # Pour chaque véhicule : ramener le plancher dans la fenêtre du
        # dépôt et fixer la plage de l'heure de départ. self.depot_open vaut
        # déjà E + delta (ouverture + chargement), donc ce max() garantit
        # que delta n'est PAS compté deux fois : pour un second trajet le
        # plancher vaut (retour + delta), et comme retour > E, on a
        # (retour + delta) > (E + delta) = depot_open, donc le plancher du
        # second trajet est conservé tel quel. Pour un premier trajet, le
        # plancher est depot_open = E + delta. Dans les deux cas delta n'est
        # appliqué qu'une seule fois.
        # Si le plancher d'un véhicule dépasse la fermeture du dépôt, ce
        # véhicule ne peut pas partir : on le fixe à la fermeture pour qu'il
        # reste inutilisé sans rendre tout le modèle infaisable (les autres
        # véhicules peuvent toujours rouler).
        usable_vehicles = 0
        for vehicle_id in range(self.num_vehicles):
            floor = departure_floors[vehicle_id]
            if floor < depot_open:
                floor = depot_open
                departure_floors[vehicle_id] = floor
            index = routing.Start(vehicle_id)
            if floor >= depot_close:
                # Plus de place dans la journée pour ce véhicule.
                time_dimension.CumulVar(index).SetRange(depot_close, depot_close)
                print(f"[DEBUG] Véhicule {self.vehicules[vehicle_id]['id']} "
                      f"ne peut pas partir avant la fermeture du dépôt - laissé inutilisé.")
            else:
                time_dimension.CumulVar(index).SetRange(floor, depot_close)
                usable_vehicles += 1

        if usable_vehicles == 0:
            print(f"[ERREUR] Aucun véhicule ne peut partir avant la fermeture du dépôt "
                  f"({depot_close}s) - aucun trajet faisable.")
            return None

        # Mémoriser les planchers par véhicule pour le rapport de départ juste-à-temps
        # dans _extract_solution.
        self._departure_floors = departure_floors

        # ========== Solutions partielles (optionnel) ==========
        if allow_partial:
            # On autorise l'abandon d'une commande contre une pénalité, mais
            # UNIQUEMENT quand aucune affectation faisable n'existe
            # (capacité / temps). La pénalité doit dominer deux choses :
            #   1. les coûts ordinaires d'arc/distance (pour que les détours
            #      valent la peine), et
            #   2. le coût fixe d'un véhicule (alpha) -- sinon le solveur
            #      trouve moins cher d'abandonner tout un camion de commandes
            #      que d'allumer un véhicule. C'est exactement ce qui cassait
            #      les seconds trajets : avec une pénalité par commande
            #      inférieure à alpha, tout groupe plus petit que
            #      (alpha / pénalité) était abandonné en bloc.
            #
            # On réutilise self._penalty_scaled, calculé en début de résolution (`solve()`),
            # afin que la disjonction et le coût de retard des fenêtres
            # souples partagent EXACTEMENT la même valeur P.
            penalty = self._penalty_scaled
            fixed_vehicle_cost = int(round(self.alpha * self.COST_SCALE))

            # Disjonction individuelle par client = chacun peut être
            # abandonné indépendamment avec la pénalité ci-dessus.
            for customer_idx in range(len(self.commandes)):
                node_index = manager.NodeToIndex(customer_idx + 1)  # +1 pour le décalage dépôt
                routing.AddDisjunction([node_index], penalty)

            print(f"[INFO] Solutions partielles activées: chacune des "
                  f"{len(self.commandes)} commandes peut être abandonnée")
            print(f"[INFO] Pénalité par commande non servie: {penalty} unités "
                  f"(> coût véhicule {fixed_vehicle_cost}, donc servir est "
                  f"préféré dès que c'est faisable)")

        # ========== Contrainte de type de véhicule (régime de température) ==========
        # Chaque véhicule a UN type unique qui définit le régime de
        # température de TOUT son chargement sur une tournée (ex. : 'NORMAL'
        # = ambiant, 'REFRIGERE' = froid, 'CONGELATEUR' = surgelé). Comme
        # toutes les commandes d'une même tournée partagent le même
        # compartiment à la même température, elles doivent TOUTES exiger ce
        # même régime : on ne peut pas mélanger des marchandises ambiantes et
        # réfrigérées dans le même camion.
        #
        # Modèle STRICT : chaque commande doit correspondre EXACTEMENT au
        # type du véhicule qui la sert. Une commande sans type explicite est
        # traitée comme 'NORMAL' (ambiant) -- elle ne peut donc PAS voyager
        # dans un camion réfrigéré ou congélateur (qui roule en froid pour
        # ses autres commandes). Cela évite qu'une marchandise ambiante soit
        # refroidie, ou qu'une marchandise froide soit réchauffée.
        #
        # Données attendues :
        #   - chaque véhicule : champ 'type_vehicule' = chaîne. Absent =>
        #     'NORMAL' par défaut.
        #   - chaque commande : champ 'type_vehicule_requis' = chaîne. Absent
        #     ou vide/None => traité comme 'NORMAL' (régime ambiant).
        #
        # Mise en œuvre : pour CHAQUE commande, on restreint la variable
        # "véhicule" de son nœud aux seuls véhicules du type correspondant,
        # via une contrainte d'appartenance (MemberCt) sur
        # routing.VehicleVar(node). On utilise cette voie portable plutôt que
        # SetAllowedVehiclesForIndex, dont le binding Python est défectueux
        # dans certaines versions d'OR-Tools (9.15). C'est une restriction
        # d'affectation pure : elle ne touche ni la dimension temporelle ni
        # les capacités.
        # NB : la valeur -1 signifie "nœud non desservi" ; on l'inclut quand
        # le mode partiel est actif pour que la commande puisse toujours être
        # abandonnée via sa disjonction si aucun véhicule compatible n'existe.
        solver = routing.solver()
        # Type de chaque véhicule (normalisé en chaîne ; 'NORMAL' par défaut).
        vehicle_types = [
            str(veh.get('type_vehicule', 'NORMAL') or 'NORMAL')
            for veh in self.vehicules
        ]
        n_restricted = 0
        for customer_idx, cmd in enumerate(self.commandes):
            # Modèle strict : une commande sans type explicite exige 'NORMAL'
            # (régime ambiant). On n'ignore plus les commandes sans exigence.
            required_type = cmd.get('type_vehicule_requis', None)
            if not required_type:
                required_type = 'NORMAL'
            required_type = str(required_type)
            # Véhicules dont le type correspond exactement à l'exigence.
            allowed = [
                int(v_id) for v_id in range(self.num_vehicles)
                if vehicle_types[v_id] == required_type
            ]
            node_index = manager.NodeToIndex(customer_idx + 1)  # +1 décalage dépôt
            if not allowed:
                # Aucun véhicule du type requis.
                print(f"[WARNING] Commande {cmd['id']} exige le type "
                      f"'{required_type}' mais aucun véhicule n'est de ce type.")
                if not allow_partial:
                    print(f"[WARNING] Sans mode partiel, le modèle risque "
                          f"d'être infaisable à cause de cette commande.")
                # En mode partiel, on force l'abandon en n'autorisant que -1.
                if allow_partial:
                    solver.Add(solver.MemberCt(routing.VehicleVar(node_index), [-1]))
                continue
            # Valeurs autorisées pour la variable véhicule du nœud.
            allowed_values = allowed + ([-1] if allow_partial else [])
            solver.Add(solver.MemberCt(routing.VehicleVar(node_index), allowed_values))
            n_restricted += 1

        if n_restricted > 0:
            print(f"[INFO] Type de véhicule : {n_restricted} commande(s) "
                  f"restreinte(s) à un type compatible")

        # ========== Contraintes de capacité (poids) ==========
        def demand_weight_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return int(self.demands[from_node]['poids'] * 10)  # Échelle pour la précision

        demand_weight_callback_index = routing.RegisterUnaryTransitCallback(
            demand_weight_callback
        )

        routing.AddDimensionWithVehicleCapacity(
            demand_weight_callback_index,
            0,  # Pas de marge
            [int(cap['poids'] * 10) for cap in self.vehicle_capacities],
            True,  # Commencer le cumul à zéro
            'Capacity_Weight'
        )

        # ========== Contraintes de capacité (volume) ==========
        def demand_volume_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return int(self.demands[from_node]['volume'] * 10)  # Échelle pour la précision

        demand_volume_callback_index = routing.RegisterUnaryTransitCallback(
            demand_volume_callback
        )

        routing.AddDimensionWithVehicleCapacity(
            demand_volume_callback_index,
            0,  # Pas de marge
            [int(cap['volume'] * 10) for cap in self.vehicle_capacities],
            True,  # Commencer le cumul à zéro
            'Capacity_Volume'
        )

        # ========== Paramètres de recherche ==========
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.FromSeconds(time_limit_seconds)

        # ========== Résolution ==========
        solution = routing.SolveWithParameters(search_parameters)

        if not solution:
            # Journaliser pourquoi aucune solution n'a été trouvée
            status = routing.status()
            status_names = {
                0: "ROUTING_NOT_SOLVED",
                1: "ROUTING_SUCCESS",
                2: "ROUTING_FAIL",
                3: "ROUTING_FAIL_TIMEOUT",
                4: "ROUTING_INVALID"
            }
            status_name = status_names.get(status, f"UNKNOWN({status})")

            print(f"[ERROR] OR-Tools failed with status: {status_name}")
            print(f"[ERROR] Problem details: {len(self.commandes)} commandes, {self.num_vehicles} vehicles")

            # Calculer la demande totale par rapport à la capacité
            total_poids = sum(c['poids'] for c in self.commandes)
            total_volume = sum(c['volume'] for c in self.commandes)
            fleet_poids = sum(v['capacite_poids'] for v in self.vehicules)
            fleet_volume = sum(v['capacite_volume'] for v in self.vehicules)

            print(f"[ERROR] Total demand: {total_poids:.1f}kg, {total_volume:.1f}m³")
            print(f"[ERROR] Fleet capacity: {fleet_poids:.1f}kg, {fleet_volume:.1f}m³")
            print(f"[ERROR] Capacity ratio: {total_poids/fleet_poids*100:.1f}% poids, {total_volume/fleet_volume*100:.1f}% volume")

            return None

        # ========== Extraction de la solution ==========
        return self._extract_solution(manager, routing, solution)

    def _extract_solution(
        self,
        manager: pywrapcp.RoutingIndexManager,
        routing: pywrapcp.RoutingModel,
        solution: pywrapcp.Assignment
    ) -> Dict[str, Any]:
        """
        Extrait la solution depuis le modèle OR-Tools.
        """
        time_dimension = routing.GetDimensionOrDie('Time')
        total_distance = 0
        routes = []
        unserved_commandes = []

        # Suivre les commandes effectivement servies
        served_order_indices = set()

        for vehicle_id in range(self.num_vehicles):
            index = routing.Start(vehicle_id)
            route_distance = 0
            route_stops = []
            first_customer_node = None  # index du nœud du premier client servi

            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                next_index = solution.Value(routing.NextVar(index))

                # Ajouter la distance de l'arc vers le prochain nœud
                route_distance += self.distance_matrix[node_index][manager.IndexToNode(next_index)]

                # Si ce n'est pas le dépôt, il s'agit d'une visite client
                if node_index != 0:
                    if first_customer_node is None:
                        first_customer_node = node_index
                    commande_idx = node_index - 1
                    served_order_indices.add(commande_idx)
                    commande = self.commandes[commande_idx]

                    # Récupérer les informations de temps
                    time_var = time_dimension.CumulVar(index)
                    arrival_time_seconds = solution.Min(time_var)

                    # Convertir en heure
                    arrival_hours = arrival_time_seconds // 3600
                    arrival_minutes = (arrival_time_seconds % 3600) // 60

                    route_stops.append({
                        'commande_id': commande['id'],
                        'ordre': len(route_stops) + 1,  # Ordre de visite (base 1)
                        'adresse': commande['adresse_livraison'],
                        'lat': commande['lat_livraison'],
                        'lon': commande['lon_livraison'],
                        'heure_arrivee_prevue': f"{arrival_hours:02d}:{arrival_minutes:02d}:00",
                        'poids': commande['poids'],
                        'volume': commande['volume'],
                    })

                index = next_index

            # Ajouter l'itinéraire uniquement s'il contient des arrêts
            if route_stops:
                # route_distance est accumulée en unités de coût (km * COST_SCALE)
                route_distance_km = route_distance / self.COST_SCALE
                total_distance += route_distance_km

                # Calculer le départ JUSTE-À-TEMPS basé sur l'itinéraire réel.
                # Raisonner à rebours depuis l'heure d'arrivée au premier arrêt.
                first_stop_arrival_str = route_stops[0]['heure_arrivee_prevue']
                first_stop_hours, first_stop_minutes, _ = map(int, first_stop_arrival_str.split(':'))
                first_stop_arrival_seconds = first_stop_hours * 3600 + first_stop_minutes * 60

                # Temps de trajet dépôt -> premier arrêt. Utiliser l'index du nœud
                # capturé pendant le parcours (robuste aux identifiants de commande dupliqués).
                travel_time_to_first = self.time_matrix[0][first_customer_node]

                # Départ juste-à-temps = première arrivée - temps de trajet.
                # Ne jamais déclarer un départ plus tôt que ce que CE véhicule pourrait
                # réellement partir: ouverture du dépôt pour un premier trajet, ou son propre
                # retour + rechargement pour un deuxième trajet contraint.
                floors = getattr(self, '_departure_floors', None)
                if floors is not None and vehicle_id < len(floors):
                    departure_floor = floors[vehicle_id]
                else:
                    departure_floor = self.time_windows[0][0]
                jit_departure_seconds = max(
                    departure_floor,
                    first_stop_arrival_seconds - travel_time_to_first
                )
                jit_departure_hours = jit_departure_seconds // 3600
                jit_departure_minutes = (jit_departure_seconds % 3600) // 60

                # Calculer l'heure de retour au dépôt (mode multi-trajets)
                # Obtenir l'heure au nœud final (quand le véhicule retourne au dépôt)
                end_index = routing.End(vehicle_id)
                end_time_var = time_dimension.CumulVar(end_index)
                return_time_seconds = solution.Min(end_time_var)
                return_hours = return_time_seconds // 3600
                return_minutes = (return_time_seconds % 3600) // 60

                routes.append({
                    'vehicule_id': self.vehicules[vehicle_id]['id'],
                    'stops': route_stops,
                    'distance': round(route_distance_km, 2),
                    'charge_poids': sum(s['poids'] for s in route_stops),
                    'charge_volume': sum(s['volume'] for s in route_stops),
                    'heure_depart_prevue': f"{jit_departure_hours:02d}:{jit_departure_minutes:02d}:00",
                    'heure_retour_depot': f"{return_hours:02d}:{return_minutes:02d}:00",
                })

        # Identifier les commandes non servies
        for idx, commande in enumerate(self.commandes):
            if idx not in served_order_indices:
                unserved_commandes.append({
                    'commande_id': commande['id'],
                    'raison': 'Capacité ou fenêtre temporelle non satisfaisable'
                })

        # Journaliser le récapitulatif
        print(f"[INFO] Solution OR-Tools: {len(routes)} itinéraires, "
              f"{len(served_order_indices)} servies, {len(unserved_commandes)} non servies")

        if len(routes) == 0:
            print(f"[WARNING] Aucun itinéraire créé - toutes les commandes non servies!")
            print(f"[WARNING] Cela signifie généralement:")
            print(f"[WARNING]   1. Capacité largement dépassée (vérifier flotte vs demande)")
            print(f"[WARNING]   2. Fenêtres temporelles impossibles à satisfaire")
            print(f"[WARNING]   3. Essayer: Ajouter plus de véhicules ou diviser les commandes sur plusieurs jours")

        return {
            'tournees': routes,
            'distance_totale': round(total_distance, 2),
            'nb_vehicules_utilises': len(routes),
            'nb_commandes_non_servies': len(unserved_commandes),
            'commandes_non_servies': unserved_commandes,
            'algorithme': 'OR_TOOLS'
        }
