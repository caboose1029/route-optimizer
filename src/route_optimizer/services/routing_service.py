import json
import requests
import polyline
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Tuple, List
from route_optimizer.models.client import ClientData
from route_optimizer.config import ORS_API_KEY

class RoutingError(Exception):
    """Base exception for routing operations"""
    pass

class RouteNotFoundError(RoutingError):
    """Raised when a route cannot be found"""
    pass

class RoutingService(ABC):
    """Abstract base class for routing services"""
    
    @abstractmethod
    def optimize_route(self, locations: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """
        Optimize route based on provided locations

        Args:
            locations: List of (latitude, longitude) tuples

        Returns:
            Optimized list of locations in order of traversal

        Raises:
            RouteNotFoundError: If no valid route can be computed
        """
        pass
    
class GoogleRoutingService(RoutingService):
    """Google Maps-based implementation of RoutingService"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://maps.googleapis.com/maps/api/directions/json"

    def optimize_route(self, locations: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        if not locations:
            raise RouteNotFoundError("No locations provided for routing")

        # Convert locations to waypoints string
        origin = f"{locations[0][0]},{locations[0][1]}"
        destination = f"{locations[-1][0]},{locations[-1][1]}"
        waypoints = '|'.join([f"{lat},{lon}" for lat, lon in locations])

        params = {
            'origin': origin,
            'destination': destination,
            'waypoints': waypoints,
            'key': self.api_key
        }

        response = requests.get(self.base_url, params=params)
        data = response.json()

        if data['status'] != 'OK':
            raise RouteNotFoundError(f"Routing error: {data['status']}")

        # Extract optimized route from response
        if 'routes' not in data or not data['routes']:
            raise RouteNotFoundError("No valid routes found")

        # Decode polyline to get the route coordinates
        encoded_polyline = data['routes'][0]['overview_polyline']['points']
        return polyline.decode(encoded_polyline)
    

class MockRoutingService(RoutingService):
    """Mock implementation using OpenRouteService for real routing without Google costs"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or ORS_API_KEY
        self.base_url = "https://api.openrouteservice.org/v2/directions"

    def optimize_route(self, locations: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        if not locations:
            raise RouteNotFoundError("No locations provided for routing")

        if len(locations) == 1:
            return locations

        if not self.api_key:
            # Fallback to straight line if no API key
            return self._straight_line_fallback(locations)

        try:
            # OpenRouteService expects [lon, lat] format, opposite of Google
            ors_locations = [[lon, lat] for lat, lon in locations]
            
            response = requests.post(
                f"{self.base_url}/driving-car/geojson",
                headers={
                    'Authorization': self.api_key,
                    'Content-Type': 'application/json'
                },
                json={
                    'coordinates': ors_locations
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                # Extract coordinates from GeoJSON (they're in [lon, lat] format)
                coordinates = data['features'][0]['geometry']['coordinates']
                # Convert back to [lat, lon] format for consistency
                return [(lat, lon) for lon, lat in coordinates]
            else:
                print(f"OpenRouteService error: {response.status_code}")
                print(f"Response: {response.text}")
                return self._straight_line_fallback(locations)
                
        except Exception as e:
            print(f"OpenRouteService API call failed: {e}")
            return self._straight_line_fallback(locations)

    def _straight_line_fallback(self, locations: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """Fallback to straight line routing if API fails"""
        # Simple optimization: sort by latitude
        optimized = sorted(locations, key=lambda x: (x[0], x[1]))
        
        # Create route with intermediate points
        route_points = []
        for i in range(len(optimized)):
            route_points.append(optimized[i])
            if i < len(optimized) - 1:
                # Add a few intermediate points for smoother visualization
                current = optimized[i]
                next_loc = optimized[i + 1]
                for j in range(1, 4):
                    ratio = j / 4
                    lat = current[0] + (next_loc[0] - current[0]) * ratio
                    lon = current[1] + (next_loc[1] - current[1]) * ratio
                    route_points.append((lat, lon))
        
        return route_points
    

def create_routing_service(api_key: Optional[str] = None) -> RoutingService:
    """
    Factory function to create a routing service instance

    Args:
        api_key: Google Maps API key (if using GoogleRoutingService)

    Returns:
        Instance of RoutingService (either GoogleRoutingService or MockRoutingService)
    """
    if api_key:
        return GoogleRoutingService(api_key)
    else:
        return MockRoutingService()

