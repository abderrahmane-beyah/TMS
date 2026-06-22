"""
Service de routage pour calculer les distances et temps de trajet réels.
Utilise uniquement des réseaux routiers réels (OSRM ou Google Maps).
"""
from typing import List, Tuple
import requests
import time
from app.config import settings


class RoutingService:
    """
    Service de calcul des distances routières et temps de trajet réels.
    Prend en charge OSRM (recommandé) ou l'API Google Distance Matrix.
    """

    def __init__(self, backend: str = "osrm"):
        """
        Initialise le service de routage.

        Args:
            backend: 'osrm' ou 'google'
        """
        if backend not in ['osrm', 'google']:
            raise ValueError(f"Backend de routage invalide : {backend}. Utilisez 'osrm' ou 'google'")

        self.backend = backend
        self.osrm_url = getattr(settings, 'OSRM_URL', 'http://router.project-osrm.org')
        self.google_api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', None)

        if backend == 'google' and not self.google_api_key:
            raise ValueError("Clé API Google Maps non configurée. Définissez GOOGLE_MAPS_API_KEY dans .env")

    def _osrm_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
        """
        Récupère la distance routière et le temps de trajet via OSRM.

        Returns:
            (distance_km, time_seconds)

        Raises:
            Exception si le service OSRM échoue ou si l'itinéraire est introuvable
        """
        # OSRM utilise le format lon,lat (et non lat,lon)
        url = f"{self.osrm_url}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
        params = {
            'overview': 'false',
            'steps': 'false'
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data['code'] != 'Ok':
                raise ValueError(f"Échec du routage OSRM : {data.get('message', 'Erreur inconnue')}")

            route = data['routes'][0]
            distance_km = route['distance'] / 1000  # Convertir les mètres en km
            time_seconds = route['duration']

            return distance_km, time_seconds

        except requests.RequestException as e:
            raise Exception(f"Erreur du service OSRM : {e}. Vérifiez la configuration OSRM_URL.")
        except (KeyError, IndexError) as e:
            raise Exception(f"Format de réponse OSRM invalide : {e}")

    def _google_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
        """
        Récupère la distance routière et le temps via l'API Google Routes (nouvelle).

        Returns:
            (distance_km, time_seconds)

        Raises:
            Exception si l'API Google échoue ou si l'itinéraire est introuvable
        """
        url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        payload = {
            "origin": {"location": {"latLng": {"latitude": lat1, "longitude": lon1}}},
            "destination": {"location": {"latLng": {"latitude": lat2, "longitude": lon2}}},
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE"
        }
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.google_api_key,
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration"
        }

        try:
            # Retry logic pour gérer les limites de taux (429)
            max_retries = 3
            retry_delay = 2

            for attempt in range(max_retries):
                try:
                    response = requests.post(url, json=payload, headers=headers, timeout=10)
                    response.raise_for_status()
                    break
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 429 and attempt < max_retries - 1:
                        wait_time = retry_delay * (2 ** attempt)
                        print(f"[WARNING] Rate limit 429, attente de {wait_time}s avant retry {attempt + 1}/{max_retries}")
                        time.sleep(wait_time)
                    else:
                        raise

            data = response.json()

            routes = data.get('routes', [])
            if not routes:
                raise ValueError("Aucun itinéraire trouvé")

            route = routes[0]
            distance_km = route['distanceMeters'] / 1000.0
            time_seconds = int(route['duration'].rstrip('s'))  # "123s" → 123

            return distance_km, time_seconds

        except requests.RequestException as e:
            raise Exception(f"Erreur API Google Routes : {e}")
        except (KeyError, IndexError) as e:
            raise Exception(f"Réponse API Google Routes invalide : {e}")

    def get_distance_and_time(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> Tuple[float, float]:
        """
        Récupère la distance routière réelle et le temps de trajet entre deux points.

        Args:
            lat1, lon1: Coordonnées d'origine
            lat2, lon2: Coordonnées de destination

        Returns:
            (distance_km, time_seconds)

        Raises:
            Exception si le service de routage échoue
        """
        if self.backend == 'osrm':
            return self._osrm_distance(lat1, lon1, lat2, lon2)
        elif self.backend == 'google':
            return self._google_distance(lat1, lon1, lat2, lon2)
        else:
            raise ValueError(f"Backend de routage invalide : {self.backend}")

    def build_matrix(
        self,
        locations: List[Tuple[float, float]]
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Construit les matrices de distance (km) et de temps (s) pour
        plusieurs emplacements, en UNE requête groupée plutôt que N*N
        requêtes individuelles.

        Args:
            locations: Liste de tuples (lat, lon). Le premier élément est
                       typiquement le dépôt.

        Returns:
            (distance_matrix_km, time_matrix_seconds)
        """
        n = len(locations)
        if n == 0:
            return [], []
        if n == 1:
            return [[0.0]], [[0]]

        # Dispatcher vers l'implémentation groupée du backend. En cas
        # d'échec de la version groupée, on retombe sur la boucle N*N
        # (lente mais robuste) afin de ne jamais bloquer une optimisation.
        try:
            if self.backend == 'osrm':
                return self._build_matrix_osrm_bulk(locations)
            elif self.backend == 'google':
                return self._build_matrix_google_bulk(locations)
        except Exception as e:
            print(f"[WARNING] Matrice groupée ({self.backend}) en échec : {e}. "
                  f"Retour à la boucle N*N (plus lente).")
            return self._build_matrix_loop(locations)

        raise ValueError(f"Backend de routage invalide : {self.backend}")

    def _build_matrix_osrm_bulk(
        self,
        locations: List[Tuple[float, float]]
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Récupère la matrice complète en UNE requête via l'API OSRM /table.
        """
        # OSRM attend le format lon,lat;lon,lat;...
        coords = ";".join(f"{lon},{lat}" for lat, lon in locations)
        url = f"{self.osrm_url}/table/v1/driving/{coords}"
        # On demande durées ET distances. Note : selon la compilation du
        # serveur OSRM, l'annotation 'distance' peut ne pas être disponible.
        params = {'annotations': 'duration,distance'}

        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        if data.get('code') != 'Ok':
            raise ValueError(f"Échec OSRM /table : {data.get('message', 'Erreur inconnue')}")

        n = len(locations)
        durations = data.get('durations')
        if durations is None:
            raise ValueError("OSRM /table n'a pas renvoyé de durées.")

        # Distances : peuvent être absentes si le serveur ne les annote pas.
        distances = data.get('distances')

        # Une grande valeur pour les paires injoignables (OSRM renvoie null).
        UNREACHABLE_KM = 1.0e7

        time_matrix = []
        for row in durations:
            time_matrix.append([
                int(v) if v is not None else int(UNREACHABLE_KM)
                for v in row
            ])

        if distances is not None:
            distance_matrix = []
            for row in distances:
                distance_matrix.append([
                    (v / 1000.0) if v is not None else UNREACHABLE_KM
                    for v in row
                ])
        else:
            # Pas de distances renvoyées : on estime la distance à partir du
            # temps et d'une vitesse moyenne, pour rester fonctionnel.
            # (Les distances ne servent qu'au coût ; les fenêtres et la
            # faisabilité reposent sur le temps, qui lui est exact.)
            print("[WARNING] OSRM /table sans distances ; estimation depuis "
                  "les durées (vitesse moyenne).")
            avg_speed_kmh = float(getattr(settings, 'AVG_SPEED_KMH', 40))
            distance_matrix = [
                [(t / 3600.0) * avg_speed_kmh for t in row]
                for row in time_matrix
            ]

        # Diagonale propre.
        for i in range(n):
            distance_matrix[i][i] = 0.0
            time_matrix[i][i] = 0

        return distance_matrix, time_matrix

    def _build_matrix_google_bulk(
        self,
        locations: List[Tuple[float, float]]
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Récupère la matrice via l'API Google Routes (nouvelle),
        en découpant en blocs pour respecter la limite de 625 éléments
        (origines * destinations) par requête.
        """
        n = len(locations)
        UNREACHABLE_KM = 1.0e7
        distance_matrix = [[0.0] * n for _ in range(n)]
        time_matrix = [[0] * n for _ in range(n)]

        # Nouveau endpoint Routes API
        url = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
        chunk_size = 25  # 25x25 = 625 éléments : limite max par requête

        for i_start in range(0, n, chunk_size):
            i_end = min(i_start + chunk_size, n)
            for j_start in range(0, n, chunk_size):
                j_end = min(j_start + chunk_size, n)

                # Nouveau format : listes d'objets avec waypoint
                origins = [
                    {"waypoint": {"location": {"latLng": {"latitude": lat, "longitude": lon}}}}
                    for lat, lon in locations[i_start:i_end]
                ]
                destinations = [
                    {"waypoint": {"location": {"latLng": {"latitude": lat, "longitude": lon}}}}
                    for lat, lon in locations[j_start:j_end]
                ]

                payload = {
                    "origins": origins,
                    "destinations": destinations,
                    "travelMode": "DRIVE",
                    "routingPreference": "TRAFFIC_UNAWARE",
                }

                # POST + headers (clé API + FieldMask obligatoire)
                headers = {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": self.google_api_key,
                    "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,status"
                }

                # Retry logic pour gérer les limites de taux (429)
                max_retries = 3
                retry_delay = 2  # secondes

                for attempt in range(max_retries):
                    try:
                        response = requests.post(url, json=payload, headers=headers, timeout=30)
                        response.raise_for_status()
                        break  # Succès, sortir de la boucle de retry
                    except requests.exceptions.HTTPError as e:
                        if e.response.status_code == 429 and attempt < max_retries - 1:
                            # Rate limit atteint, attendre avant de réessayer
                            wait_time = retry_delay * (2 ** attempt)  # Backoff exponentiel
                            print(f"[WARNING] Rate limit 429, attente de {wait_time}s avant retry {attempt + 1}/{max_retries}")
                            time.sleep(wait_time)
                        else:
                            raise  # Re-lever l'erreur si ce n'est pas 429 ou si max retries atteint

                # Nouveau format de réponse : liste plate d'éléments
                data = response.json()
                elements = data if isinstance(data, list) else data.get('elements', [])

                for el in elements:
                    oi = el.get('originIndex', 0)
                    dj = el.get('destinationIndex', 0)
                    i_actual = i_start + oi
                    j_actual = j_start + dj

                    # status est un objet {code: ...} dans la Routes API
                    status_code = el.get('status', {}).get('code', 0)
                    condition = el.get('condition', '')

                    if condition == 'ROUTE_NOT_FOUND' or status_code != 0:
                        distance_matrix[i_actual][j_actual] = (
                            0.0 if i_actual == j_actual else UNREACHABLE_KM
                        )
                        time_matrix[i_actual][j_actual] = (
                            0 if i_actual == j_actual else int(UNREACHABLE_KM)
                        )
                    else:
                        # distanceMeters peut être absent pour les éléments diagonaux
                        distance_matrix[i_actual][j_actual] = el.get('distanceMeters', 0) / 1000.0
                        # duration est une string "123s" dans la Routes API
                        duration_str = el.get('duration', '0s')
                        time_matrix[i_actual][j_actual] = int(duration_str.rstrip('s'))

                # Délai entre les chunks pour éviter de saturer le rate limit Google
                # Pour 100+ commandes, augmenter à 2s minimum
                time.sleep(2.0)

        for i in range(n):
            distance_matrix[i][i] = 0.0
            time_matrix[i][i] = 0

        return distance_matrix, time_matrix

    def _build_matrix_loop(
        self,
        locations: List[Tuple[float, float]]
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Ancienne méthode : N*N requêtes individuelles. Lente, conservée
        uniquement comme repli robuste si la version groupée échoue.
        """
        n = len(locations)
        distance_matrix = []
        time_matrix = []

        for i in range(n):
            dist_row = []
            time_row = []
            for j in range(n):
                if i == j:
                    dist_row.append(0.0)
                    time_row.append(0)
                else:
                    lat1, lon1 = locations[i]
                    lat2, lon2 = locations[j]
                    distance, time = self.get_distance_and_time(lat1, lon1, lat2, lon2)
                    dist_row.append(distance)
                    time_row.append(time)
            distance_matrix.append(dist_row)
            time_matrix.append(time_row)

        return distance_matrix, time_matrix


# Instance singleton
_routing_service = None


def get_routing_service(backend: str = "osrm") -> RoutingService:
    """
    Récupère ou crée l'instance singleton du service de routage.

    Args:
        backend: 'osrm' ou 'google' (routage réel uniquement)
    """
    global _routing_service
    if _routing_service is None or _routing_service.backend != backend:
        _routing_service = RoutingService(backend)
    return _routing_service