"""
Routing service for calculating real distances and travel times
Only uses real road networks (OSRM or Google Maps)
"""
from typing import List, Tuple
import requests
from app.config import settings


class RoutingService:
    """
    Service for calculating real road distances and travel times
    Supports OSRM (recommended) or Google Maps Distance Matrix API
    """

    def __init__(self, backend: str = "osrm"):
        """
        Initialize routing service

        Args:
            backend: 'osrm' or 'google'
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
        Get real road distance and time using OSRM

        Returns:
            (distance_km, time_seconds)

        Raises:
            Exception if OSRM service fails or route not found
        """
        # OSRM uses lon,lat format
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
            distance_km = route['distance'] / 1000  # Convert meters to km
            time_seconds = route['duration']

            return distance_km, time_seconds

        except requests.RequestException as e:
            raise Exception(f"OSRM service error: {e}. Check OSRM_URL configuration.")
        except (KeyError, IndexError) as e:
            raise Exception(f"Invalid OSRM response format: {e}")

    def _google_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
        """
        Get real road distance and time using Google Maps Distance Matrix API

        Returns:
            (distance_km, time_seconds)

        Raises:
            Exception if Google Maps API fails or route not found
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

            distance_km = element['distance']['value'] / 1000  # meters to km
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
        Get real road distance and travel time between two points

        Args:
            lat1, lon1: Origin coordinates
            lat2, lon2: Destination coordinates

        Returns:
            (distance_km, time_seconds)

        Raises:
            Exception if routing service fails
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
        Build distance and time matrices for multiple locations

        Args:
            locations: List of (lat, lon) tuples

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


# Singleton instance
_routing_service = None


def get_routing_service(backend: str = "osrm") -> RoutingService:
    """
    Get or create routing service singleton

    Args:
        backend: 'osrm' or 'google' (only real routing supported)
    """
    global _routing_service
    if _routing_service is None or _routing_service.backend != backend:
        _routing_service = RoutingService(backend)
    return _routing_service
