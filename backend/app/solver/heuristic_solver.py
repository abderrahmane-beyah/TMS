"""
Solomon I1 Insertion Heuristic for VRPTW
Based on: Solomon, M. M. (1987). "Algorithms for the Vehicle Routing and
Scheduling Problems with Time Window Constraints." Operations Research, 35(2), 254-265.

Uses real road routing via OSRM or Google Maps
"""
from typing import List, Dict, Any, Tuple, Optional
from datetime import time
from app.services.routing_service import get_routing_service
from app.config import settings


class SolomonI1VRPTWSolver:
    """
    Solomon's I1 Insertion Heuristic for VRPTW

    Sequential insertion heuristic that:
    1. Selects seed customer (furthest from depot)
    2. Sequentially inserts customers based on composite cost
    3. Cost considers distance AND time window urgency
    4. Creates new routes when necessary

    Parameters:
        alpha1: Weight for distance cost (default 1.0)
        alpha2: Weight for time urgency cost (default 0.1)
        mu: Detour penalty factor (default 1.0)
    """

    def __init__(
        self,
        commandes: List[Dict],
        vehicules: List[Dict],
        depot_lat: float = 18.0735,
        depot_lon: float = -15.9582,
        alpha1: float = 1.0,   # Distance weight
        alpha2: float = 0.1,   # Time urgency weight
        mu: float = 1.0,       # Detour penalty
    ):
        """
        Initialize Solomon I1 solver

        Args:
            commandes: List of order dictionaries
            vehicules: List of vehicle dictionaries
            depot_lat: Depot latitude
            depot_lon: Depot longitude
            alpha1: Weight for distance cost in insertion criterion
            alpha2: Weight for time window urgency cost
            mu: Penalty factor for route detour
        """
        self.commandes = commandes
        self.vehicules = vehicules
        self.depot_lat = depot_lat
        self.depot_lon = depot_lon

        # Solomon parameters
        self.alpha1 = alpha1
        self.alpha2 = alpha2
        self.mu = mu

        # Get routing service for real road distances
        self.routing_service = get_routing_service(backend=settings.ROUTING_BACKEND)

        # Pre-build distance/time matrices
        self._build_matrices()

    def _build_matrices(self):
        """
        Build distance and time matrices using real road routing
        """
        # Build locations list: depot + customers
        locations = [(self.depot_lat, self.depot_lon)]
        for cmd in self.commandes:
            locations.append((cmd['lat_livraison'], cmd['lon_livraison']))

        # Get real distance and time matrices from routing service
        self.distance_matrix_km, self.time_matrix_sec = self.routing_service.build_matrix(locations)

    def _get_distance(self, from_idx: int, to_idx: int) -> float:
        """Get distance between two locations (in km)"""
        return self.distance_matrix_km[from_idx][to_idx]

    def _get_time(self, from_idx: int, to_idx: int) -> int:
        """Get travel time between two locations (in seconds)"""
        return self.time_matrix_sec[from_idx][to_idx]

    def _time_to_seconds(self, t: time) -> int:
        """Convert time to seconds since midnight"""
        return int(t.hour * 3600 + t.minute * 60 + t.second)

    def _seconds_to_time(self, seconds: int) -> str:
        """Convert seconds to HH:MM:SS format"""
        seconds = int(seconds)
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def _calculate_insertion_cost(
        self,
        route: List[int],
        insert_idx: int,
        customer_idx: int,
        arrival_times: List[int]
    ) -> Optional[Tuple[float, List[int]]]:
        """
        Calculate cost of inserting customer at position insert_idx in route

        Returns:
            (cost, new_arrival_times) if feasible, None if infeasible
        """
        # Insert customer into route temporarily
        new_route = route[:insert_idx] + [customer_idx] + route[insert_idx:]

        # Calculate new arrival times
        new_arrival_times = self._calculate_route_times(new_route)

        if new_arrival_times is None:
            return None  # Time window violation

        # Get positions
        i = route[insert_idx - 1] if insert_idx > 0 else -1  # -1 = depot
        u = customer_idx
        j = route[insert_idx] if insert_idx < len(route) else -1  # -1 = depot

        # Location indices (depot = 0, customer k = k+1)
        loc_i = 0 if i == -1 else i + 1
        loc_u = u + 1
        loc_j = 0 if j == -1 else j + 1

        # c1: Distance cost = d(i,u) + d(u,j) - mu * d(i,j)
        d_iu = self._get_distance(loc_i, loc_u)
        d_uj = self._get_distance(loc_u, loc_j)
        d_ij = self._get_distance(loc_i, loc_j)

        c1 = d_iu + d_uj - self.mu * d_ij

        # c2: Time urgency cost
        # Based on how much time slack remains after insertion
        customer = self.commandes[u]
        closing_time = self._time_to_seconds(customer['heure_fermeture'])
        arrival_time = new_arrival_times[insert_idx]

        # Time slack before deadline
        c2 = max(0, closing_time - arrival_time)

        # Composite cost
        cost = self.alpha1 * c1 + self.alpha2 * c2

        return (cost, new_arrival_times)

    def _calculate_route_times(self, route: List[int]) -> Optional[List[int]]:
        """
        Calculate arrival times for route

        Args:
            route: List of customer indices (0-indexed)

        Returns:
            List of arrival times (seconds), or None if time windows violated
        """
        arrival_times = []
        current_time = 6 * 3600  # Start at 6 AM
        prev_location_idx = 0  # Depot

        for customer_idx in route:
            location_idx = customer_idx + 1  # Customer location
            customer = self.commandes[customer_idx]

            # Travel time
            travel_time = self._get_time(prev_location_idx, location_idx)
            arrival_time = current_time + travel_time

            # Time window bounds
            earliest = self._time_to_seconds(customer['heure_ouverture'])
            latest = self._time_to_seconds(customer['heure_fermeture'])

            # Wait if arrived too early
            if arrival_time < earliest:
                arrival_time = earliest

            # Check if within time window
            if arrival_time > latest:
                return None  # Infeasible

            arrival_times.append(arrival_time)

            # Service time: 10 minutes
            service_time = 600
            current_time = arrival_time + service_time
            prev_location_idx = location_idx

        return arrival_times

    def _calculate_route_distance(self, route: List[int]) -> float:
        """
        Calculate total distance for route (depot -> customers -> depot)

        Args:
            route: List of customer indices (0-indexed)

        Returns:
            Total distance in kilometers
        """
        if not route:
            return 0.0

        total_distance = 0.0

        # Depot to first customer
        total_distance += self._get_distance(0, route[0] + 1)

        # Between customers
        for i in range(len(route) - 1):
            loc_from = route[i] + 1
            loc_to = route[i + 1] + 1
            total_distance += self._get_distance(loc_from, loc_to)

        # Last customer to depot
        total_distance += self._get_distance(route[-1] + 1, 0)

        return total_distance

    def _check_capacity(self, route: List[int], vehicle: Dict) -> bool:
        """
        Check if route respects vehicle capacity (weight and volume)
        """
        total_poids = sum(self.commandes[i]['poids'] for i in route)
        total_volume = sum(self.commandes[i]['volume'] for i in route)

        return (total_poids <= vehicle['capacite_poids'] and
                total_volume <= vehicle['capacite_volume'])

    def _select_seed_customer(self, unrouted: set) -> int:
        """
        Select seed customer for new route (furthest from depot)

        Args:
            unrouted: Set of unrouted customer indices

        Returns:
            Customer index to use as seed
        """
        max_distance = -1
        seed = None

        for customer_idx in unrouted:
            distance = self._get_distance(0, customer_idx + 1)
            if distance > max_distance:
                max_distance = distance
                seed = customer_idx

        return seed

    def solve(self) -> Dict[str, Any]:
        """
        Solve VRPTW using Solomon I1 insertion heuristic

        Returns:
            Solution dictionary with routes and metrics
        """
        n = len(self.commandes)

        # Initialize
        routes = []  # List of routes (each route is list of customer indices)
        route_vehicles = []  # Vehicle assigned to each route
        route_arrival_times = []  # Arrival times for each route
        unrouted = set(range(n))  # All customers initially unrouted

        vehicle_idx = 0

        # Main loop: while there are unrouted customers and available vehicles
        while unrouted and vehicle_idx < len(self.vehicules):
            vehicle = self.vehicules[vehicle_idx]

            # Select seed customer (furthest from depot)
            seed = self._select_seed_customer(unrouted)
            current_route = [seed]
            unrouted.remove(seed)

            # Calculate initial arrival times
            arrival_times = self._calculate_route_times(current_route)
            if arrival_times is None:
                # Seed infeasible (shouldn't happen with proper data)
                continue

            # Sequential insertion
            improved = True
            while improved and unrouted:
                improved = False
                best_cost = float('inf')
                best_customer = None
                best_position = None
                best_arrival_times = None

                # Try to insert each unrouted customer
                for customer_idx in unrouted:
                    # Try each position in current route
                    for insert_pos in range(len(current_route) + 1):
                        # Calculate insertion cost
                        result = self._calculate_insertion_cost(
                            current_route,
                            insert_pos,
                            customer_idx,
                            arrival_times
                        )

                        if result is None:
                            continue  # Infeasible insertion

                        cost, new_arrival_times = result

                        # Check capacity
                        test_route = current_route[:insert_pos] + [customer_idx] + current_route[insert_pos:]
                        if not self._check_capacity(test_route, vehicle):
                            continue

                        # Update best if lower cost
                        if cost < best_cost:
                            best_cost = cost
                            best_customer = customer_idx
                            best_position = insert_pos
                            best_arrival_times = new_arrival_times

                # Insert best customer if found
                if best_customer is not None:
                    current_route.insert(best_position, best_customer)
                    arrival_times = best_arrival_times
                    unrouted.remove(best_customer)
                    improved = True

            # Save route
            if current_route:
                routes.append(current_route)
                route_vehicles.append(vehicle['id'])
                route_arrival_times.append(arrival_times)

            vehicle_idx += 1

        # Build solution
        tournees = []
        total_distance = 0

        for i, route in enumerate(routes):
            route_distance = self._calculate_route_distance(route)
            total_distance += route_distance

            stops = []
            for idx, customer_idx in enumerate(route):
                customer = self.commandes[customer_idx]
                stops.append({
                    'commande_id': customer['id'],
                    'ordre': idx,
                    'adresse': customer['adresse_livraison'],
                    'lat': customer['lat_livraison'],
                    'lon': customer['lon_livraison'],
                    'heure_arrivee_prevue': self._seconds_to_time(route_arrival_times[i][idx]),
                    'poids': customer['poids'],
                    'volume': customer['volume'],
                })

            tournees.append({
                'vehicule_id': route_vehicles[i],
                'stops': stops,
                'distance': round(route_distance, 2),
                'charge_poids': sum(s['poids'] for s in stops),
                'charge_volume': sum(s['volume'] for s in stops),
            })

        # Unserved customers
        unserved_commandes = []
        for customer_idx in unrouted:
            customer = self.commandes[customer_idx]
            unserved_commandes.append({
                'commande_id': customer['id'],
                'raison': 'Capacité insuffisante ou fenêtre temporelle non satisfaisable'
            })

        return {
            'tournees': tournees,
            'distance_totale': round(total_distance, 2),
            'nb_vehicules_utilises': len(tournees),
            'nb_commandes_non_servies': len(unserved_commandes),
            'commandes_non_servies': unserved_commandes,
            'algorithme': 'SOLOMON_I1'
        }


# Alias for backward compatibility
HeuristicVRPTWSolver = SolomonI1VRPTWSolver
