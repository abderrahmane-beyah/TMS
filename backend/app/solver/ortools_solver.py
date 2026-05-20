"""
OR-Tools solver for VRPTW (Vehicle Routing Problem with Time Windows)
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import time
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from app.services.routing_service import get_routing_service
from app.config import settings


class ORToolsVRPTWSolver:
    """
    Solver using Google OR-Tools for VRPTW optimization
    Uses real road routing via OSRM or Google Maps

    Objective function (Equation 1.3): min(α * Σ y_k + β * Σ Σ d_ij * x_ijk)
    where:
        α (alpha): coefficient for number of vehicles used
        β (beta): coefficient for total distance traveled
    """

    def __init__(
        self,
        commandes: List[Dict],
        vehicules: List[Dict],
        depot_lat: float = 18.0735,  # Nouakchott default depot
        depot_lon: float = -15.9582,
        alpha: float = 10000.0,  # α: Cost per vehicle used (default: 10000)
        beta: float = 1.0,       # β: Cost per km traveled (default: 1.0)
    ):
        """
        Initialize the OR-Tools solver

        Args:
            commandes: List of order dictionaries
            vehicules: List of vehicle dictionaries
            depot_lat: Depot latitude
            depot_lon: Depot longitude
            alpha: Coefficient for vehicle usage cost (Equation 1.3)
            beta: Coefficient for distance cost (Equation 1.3)
        """
        self.commandes = commandes
        self.vehicules = vehicules
        self.depot_lat = depot_lat
        self.depot_lon = depot_lon
        self.alpha = alpha  # Cost per vehicle
        self.beta = beta    # Cost per km

        # Get routing service
        self.routing_service = get_routing_service(backend=settings.ROUTING_BACKEND)

        # Number of locations (depot + delivery locations)
        self.num_locations = 1 + len(commandes)
        self.num_vehicles = len(vehicules)

        # Build data structures using real routing
        self._build_matrices()
        self.time_windows = self._build_time_windows()
        self.demands = self._build_demands()
        self.vehicle_capacities = self._build_vehicle_capacities()

    def _build_matrices(self):
        """
        Build distance and time matrices using real road routing
        """
        # Build locations list
        locations = [(self.depot_lat, self.depot_lon)]
        for cmd in self.commandes:
            locations.append((cmd['lat_livraison'], cmd['lon_livraison']))

        # Get real distance and time matrices from routing service
        distance_matrix_km, time_matrix_sec = self.routing_service.build_matrix(locations)

        # Convert to scaled integers for OR-Tools
        # Distance: km -> meters -> scaled by 100
        self.distance_matrix = [
            [int(dist * 1000 * 100) for dist in row]
            for row in distance_matrix_km
        ]

        # Time: already in seconds, convert to int
        self.time_matrix = [
            [int(t) for t in row]
            for row in time_matrix_sec
        ]

    def _time_to_seconds(self, t: time) -> int:
        """Convert time to seconds since midnight"""
        return int(t.hour * 3600 + t.minute * 60 + t.second)

    def _build_time_windows(self) -> List[Tuple[int, int]]:
        """
        Build time windows for each location
        Returns list of (earliest, latest) tuples in seconds since midnight
        """
        # Depot: open early morning to late evening
        windows = [(6 * 3600, 20 * 3600)]  # 6:00 AM to 8:00 PM

        for cmd in self.commandes:
            start = int(self._time_to_seconds(cmd['heure_ouverture']))
            end = int(self._time_to_seconds(cmd['heure_fermeture']))
            windows.append((start, end))

        return windows

    def _build_demands(self) -> List[Dict[str, float]]:
        """
        Build demand for each location (weight and volume)
        """
        demands = [{'poids': 0, 'volume': 0}]  # Depot has no demand

        for cmd in self.commandes:
            demands.append({
                'poids': cmd['poids'],
                'volume': cmd['volume']
            })

        return demands

    def _build_vehicle_capacities(self) -> List[Dict[str, float]]:
        """
        Build capacity constraints for each vehicle
        """
        capacities = []
        for veh in self.vehicules:
            capacities.append({
                'poids': veh['capacite_poids'],
                'volume': veh['capacite_volume']
            })

        return capacities

    def solve(self, time_limit_seconds: int = 30) -> Optional[Dict[str, Any]]:
        """
        Solve the VRPTW problem

        Args:
            time_limit_seconds: Maximum time to spend solving

        Returns:
            Solution dictionary with routes and metrics, or None if no solution
        """
        print(f"[DEBUG] Solving VRPTW with {self.num_locations} locations, {self.num_vehicles} vehicles")
        print(f"[DEBUG] Time windows: {self.time_windows[:5]}...")  # Show first 5

        # Create routing index manager
        manager = pywrapcp.RoutingIndexManager(
            self.num_locations,
            self.num_vehicles,
            0  # Depot index
        )

        # Create routing model
        routing = pywrapcp.RoutingModel(manager)

        # ========== Distance Callback (scaled by β) ==========
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            # Apply β coefficient to distance cost
            return int(self.distance_matrix[from_node][to_node] * self.beta)

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # ========== Fixed Vehicle Cost (α coefficient) ==========
        # Apply α coefficient: cost per vehicle used (Equation 1.3)
        # Convert to scaled integer (alpha is in real units, scale to match distance)
        fixed_vehicle_cost = int(self.alpha * 1000 * 100)  # Scale to match distance units
        routing.SetFixedCostOfAllVehicles(fixed_vehicle_cost)

        # ========== Time Callback (with service time) ==========
        def time_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            travel_time = self.time_matrix[from_node][to_node]

            # Add service time at the 'from' location (10 minutes for customers, 0 for depot)
            service_time = 0 if from_node == 0 else 600  # 600 seconds = 10 minutes

            return travel_time + service_time

        time_callback_index = routing.RegisterTransitCallback(time_callback)

        # Add time dimension
        time_dimension_name = 'Time'

        # Calculate maximum route time from depot window
        # (depot close - depot open) to allow full working day
        max_route_time = self.time_windows[0][1] - self.time_windows[0][0]  # Depot hours

        routing.AddDimension(
            time_callback_index,
            7200,  # Allow 2 hours waiting time at each location (for early arrivals)
            max_route_time,  # Maximum time per route: depot working hours
            False,  # Don't force start cumul to zero
            time_dimension_name
        )
        time_dimension = routing.GetDimensionOrDie(time_dimension_name)

        # Add time window constraints
        for location_idx, (earliest, latest) in enumerate(self.time_windows):
            if location_idx == 0:
                continue  # Skip depot
            index = manager.NodeToIndex(location_idx)
            # Ensure values are integers
            earliest_int = int(earliest)
            latest_int = int(latest)
            try:
                time_dimension.CumulVar(index).SetRange(earliest_int, latest_int)
            except Exception as e:
                print(f"[ERROR] Failed to set time window for location {location_idx}: [{earliest_int}, {latest_int}]")
                print(f"[ERROR] {e}")
                raise

        # Add time window for depot (start and end)
        depot_idx = manager.NodeToIndex(0)
        time_dimension.CumulVar(depot_idx).SetRange(
            self.time_windows[0][0],
            self.time_windows[0][1]
        )

        # Instantiate route start and end times to produce feasible times
        for vehicle_id in range(self.num_vehicles):
            index = routing.Start(vehicle_id)
            time_dimension.CumulVar(index).SetRange(
                self.time_windows[0][0],
                self.time_windows[0][1]
            )

        # ========== Capacity Constraints (Weight) ==========
        def demand_weight_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return int(self.demands[from_node]['poids'] * 10)  # Scale for precision

        demand_weight_callback_index = routing.RegisterUnaryTransitCallback(
            demand_weight_callback
        )

        routing.AddDimensionWithVehicleCapacity(
            demand_weight_callback_index,
            0,  # No slack
            [int(cap['poids'] * 10) for cap in self.vehicle_capacities],
            True,  # Start cumul to zero
            'Capacity_Weight'
        )

        # ========== Capacity Constraints (Volume) ==========
        def demand_volume_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return int(self.demands[from_node]['volume'] * 10)  # Scale for precision

        demand_volume_callback_index = routing.RegisterUnaryTransitCallback(
            demand_volume_callback
        )

        routing.AddDimensionWithVehicleCapacity(
            demand_volume_callback_index,
            0,  # No slack
            [int(cap['volume'] * 10) for cap in self.vehicle_capacities],
            True,  # Start cumul to zero
            'Capacity_Volume'
        )

        # ========== Search Parameters ==========
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.FromSeconds(time_limit_seconds)

        # ========== Solve ==========
        solution = routing.SolveWithParameters(search_parameters)

        if not solution:
            return None

        # ========== Extract Solution ==========
        return self._extract_solution(manager, routing, solution)

    def _extract_solution(
        self,
        manager: pywrapcp.RoutingIndexManager,
        routing: pywrapcp.RoutingModel,
        solution: pywrapcp.Assignment
    ) -> Dict[str, Any]:
        """
        Extract solution from OR-Tools model
        """
        time_dimension = routing.GetDimensionOrDie('Time')
        total_distance = 0
        routes = []
        unserved_commandes = []

        # Track which orders are served
        served_order_indices = set()

        for vehicle_id in range(self.num_vehicles):
            index = routing.Start(vehicle_id)
            route_distance = 0
            route_stops = []

            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                next_index = solution.Value(routing.NextVar(index))

                # Add arc distance to next node
                route_distance += self.distance_matrix[node_index][manager.IndexToNode(next_index)]

                # If not depot and not end, this is a customer visit
                if node_index != 0:
                    commande_idx = node_index - 1
                    served_order_indices.add(commande_idx)
                    commande = self.commandes[commande_idx]

                    # Get time info
                    time_var = time_dimension.CumulVar(index)
                    arrival_time_seconds = solution.Min(time_var)

                    # Convert to time
                    arrival_hours = arrival_time_seconds // 3600
                    arrival_minutes = (arrival_time_seconds % 3600) // 60

                    route_stops.append({
                        'commande_id': commande['id'],
                        'ordre': len(route_stops),
                        'adresse': commande['adresse_livraison'],
                        'lat': commande['lat_livraison'],
                        'lon': commande['lon_livraison'],
                        'heure_arrivee_prevue': f"{arrival_hours:02d}:{arrival_minutes:02d}:00",
                        'poids': commande['poids'],
                        'volume': commande['volume'],
                    })

                index = next_index

            # Only add route if it has stops
            if route_stops:
                route_distance_km = route_distance / 100 / 1000  # Scale back to km
                total_distance += route_distance_km

                routes.append({
                    'vehicule_id': self.vehicules[vehicle_id]['id'],
                    'stops': route_stops,
                    'distance': round(route_distance_km, 2),
                    'charge_poids': sum(s['poids'] for s in route_stops),
                    'charge_volume': sum(s['volume'] for s in route_stops),
                })

        # Find unserved orders
        for idx, commande in enumerate(self.commandes):
            if idx not in served_order_indices:
                unserved_commandes.append({
                    'commande_id': commande['id'],
                    'raison': 'Capacité ou fenêtre temporelle non satisfaisable'
                })

        return {
            'tournees': routes,
            'distance_totale': round(total_distance, 2),
            'nb_vehicules_utilises': len(routes),
            'nb_commandes_non_servies': len(unserved_commandes),
            'commandes_non_servies': unserved_commandes,
            'algorithme': 'OR_TOOLS'
        }
