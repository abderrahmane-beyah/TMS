"""
Service de routage pour calculer les distances et temps de trajet réels.
Utilise uniquement des réseaux routiers réels (OSRM ou Google Maps).
"""
from typing import List, Tuple
import requests
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
            raise ValueError(f"Invalid routing backend: {backend}. Use 'osrm' or 'google'")

        self.backend = backend
        self.osrm_url = getattr(settings, 'OSRM_URL', 'http://router.project-osrm.org')
        self.google_api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', None)

        if backend == 'google' and not self.google_api_key:
            raise ValueError("Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY in .env")

    def _osrm_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
        """
        Récupère la distance routière et le temps de trajet via OSRM.

        Returns:
            (distance_km, time_seconds)

        Raises:
            Exception si le service OSRM échoue ou si l'itinéraire est introuvable
        """
        # OSRM utilise le format lon,lat
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
                raise ValueError(f"OSRM routing failed: {data.get('message', 'Unknown error')}")

            route = data['routes'][0]
            distance_km = route['distance'] / 1000  # Convertir les mètres en km
            time_seconds = route['duration']

            return distance_km, time_seconds

        except requests.RequestException as e:
            raise Exception(f"OSRM service error: {e}. Check OSRM_URL configuration.")
        except (KeyError, IndexError) as e:
            raise Exception(f"Invalid OSRM response format: {e}")

    def _google_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
        """
        Récupère la distance routière et le temps via l'API Google Distance Matrix.

        Returns:
            (distance_km, time_seconds)

        Raises:
            Exception si l'API Google échoue ou si l'itinéraire est introuvable
        """
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            'origins': f"{lat1},{lon1}",
            'destinations': f"{lat2},{lon2}",
            'key': self.google_api_key,
            'mode': 'driving'
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data['status'] != 'OK':
                raise ValueError(f"Google Maps API error: {data['status']}")

            element = data['rows'][0]['elements'][0]
            if element['status'] != 'OK':
                raise ValueError(f"Route not found: {element['status']}")

            distance_km = element['distance']['value'] / 1000  # mètres vers km
            time_seconds = element['duration']['value']

            return distance_km, time_seconds

        except requests.RequestException as e:
            raise Exception(f"Google Maps API error: {e}")
        except (KeyError, IndexError) as e:
            raise Exception(f"Invalid Google Maps API response: {e}")

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
            raise ValueError(f"Invalid routing backend: {self.backend}")

    def build_matrix(
        self,
        locations: List[Tuple[float, float]]
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Construit les matrices de distance et de temps pour plusieurs emplacements.

        Args:
            locations: Liste de tuples (lat, lon)

        Returns:
            (distance_matrix_km, time_matrix_seconds)
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
