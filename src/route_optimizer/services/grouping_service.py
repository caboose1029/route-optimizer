import json
import requests
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Optional, Tuple, Dict
from pydantic import BaseModel
from route_optimizer.models.client import ClientData
from route_optimizer.models.client_group import ClientGroup


class GroupingError(Exception):
    """Base exception for grouping operations"""
    pass


class RoadDataError(GroupingError):
    """Raised when road data cannot be retrieved"""
    pass


class ClientGroupingService(ABC):
    """Abstract base class for client grouping services"""
    
    @abstractmethod
    def group_clients(self, clients: List[ClientData]) -> List[ClientGroup]:
        """
        Group clients by proximity and road network
        
        Args:
            clients: List of clients to group
            
        Returns:
            List of client groups optimized for minimum stops
        """
        pass


class GoogleRoadsGroupingService(ClientGroupingService):
    """Google Roads API implementation of client grouping"""
    
    def __init__(
        self, 
        api_key: str, 
        cache_file_path: Optional[Path] = None,
        max_walking_distance: float = 200.0,
        intersection_tolerance: float = 50.0
    ):
        """
        Initialize Google Roads grouping service
        
        Args:
            api_key: Google Maps API key
            cache_file_path: Optional path to cache file for storing road data
            max_walking_distance: Maximum distance (meters) clients can be apart in same group
            intersection_tolerance: Distance (meters) from intersection to consider cross-street grouping
        """
        self.api_key = api_key
        self.cache_file_path = cache_file_path or Path("roads_cache.json")
        self.max_walking_distance = max_walking_distance
        self.intersection_tolerance = intersection_tolerance
        self.base_url = "https://roads.googleapis.com/v1/snapToRoads"
    
    def _load_cache(self) -> Dict[str, dict]:
        """Load road data cache from file"""
        if self.cache_file_path.exists():
            try:
                with open(self.cache_file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}
    
    def _save_cache(self, cache: Dict[str, dict]) -> None:
        """Save road data cache to file"""
        try:
            self.cache_file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file_path, "w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2)
        except IOError as e:
            print(f"Warning: Could not save roads cache: {e}")
    
    def _cache_key(self, lat: float, lon: float) -> str:
        """Generate cache key for coordinates"""
        return f"{lat:.6f},{lon:.6f}"
    
    def _call_roads_api(self, coordinates: List[Tuple[float, float]]) -> Dict[str, dict]:
        """Call Google Roads API to get road information"""
        # Convert coordinates to path parameter (lat,lng|lat,lng|...)
        path = "|".join([f"{lat},{lon}" for lat, lon in coordinates])
        
        params = {
            "path": path,
            "interpolate": "true",
            "key": self.api_key
        }
        
        print(f"Debug: Calling Roads API with {len(coordinates)} coordinates")
        
        try:
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            if "snappedPoints" not in result:
                raise RoadDataError("No road data returned from API")
            
            print(f"Debug: Got {len(result['snappedPoints'])} snapped points")
            
            # Extract place IDs and get road names
            place_ids = []
            point_mapping = {}
            
            for i, point in enumerate(result["snappedPoints"]):
                if "originalIndex" in point and point["originalIndex"] < len(coordinates):
                    place_id = point.get("placeId")
                    if place_id:
                        place_ids.append(place_id)
                        original_coord = coordinates[point["originalIndex"]]
                        cache_key = self._cache_key(original_coord[0], original_coord[1])
                        point_mapping[place_id] = {
                            "cache_key": cache_key,
                            "snapped_lat": point["location"]["latitude"],
                            "snapped_lon": point["location"]["longitude"]
                        }
            
            # Get road names from Places API
            road_names = self._get_road_names_from_place_ids(place_ids)
            
            # Build final road data
            road_data = {}
            for place_id, mapping in point_mapping.items():
                road_data[mapping["cache_key"]] = {
                    "road_name": road_names.get(place_id, "Unknown Road"),
                    "road_id": place_id,
                    "snapped_lat": mapping["snapped_lat"],
                    "snapped_lon": mapping["snapped_lon"]
                }
            
            print(f"Debug: Final road_data with {len(road_data)} entries")
            return road_data
            
        except requests.RequestException as e:
            raise RoadDataError(f"Roads API request failed: {e}")
        except KeyError as e:
            raise RoadDataError(f"Unexpected API response format: {e}")
    
    def _get_road_names_from_place_ids(self, place_ids: List[str]) -> Dict[str, str]:
        """Get road names from place IDs using Places API"""
        if not place_ids:
            return {}
        
        road_names = {}
        places_url = "https://maps.googleapis.com/maps/api/place/details/json"
        
        for place_id in place_ids:
            try:
                params = {
                    "place_id": place_id,
                    "fields": "name,formatted_address",
                    "key": self.api_key
                }
                
                response = requests.get(places_url, params=params, timeout=5)
                response.raise_for_status()
                
                result = response.json()
                
                if result.get("status") == "OK" and "result" in result:
                    # Try to get a clean road name
                    name = result["result"].get("name", "")
                    formatted_address = result["result"].get("formatted_address", "")
                    
                    # Use name if it looks like a road, otherwise parse from address
                    if name and any(word in name.lower() for word in ["st", "street", "ave", "avenue", "rd", "road", "blvd", "boulevard", "dr", "drive", "ln", "lane", "way", "ct", "court"]):
                        road_names[place_id] = name
                    else:
                        # Parse road name from formatted address
                        road_name = self._parse_road_name_from_address(formatted_address)
                        road_names[place_id] = road_name
                else:
                    print(f"Warning: Could not get name for place ID {place_id}")
                    road_names[place_id] = "Unknown Road"
                    
            except Exception as e:
                print(f"Warning: Places API failed for {place_id}: {e}")
                road_names[place_id] = "Unknown Road"
        
        return road_names
    
    def _parse_road_name_from_address(self, formatted_address: str) -> str:
        """Extract road name from formatted address"""
        if not formatted_address:
            return "Unknown Road"
        
        # Split address and take first part (usually the road)
        parts = formatted_address.split(",")
        if parts:
            # Remove house numbers from the beginning
            road_part = parts[0].strip()
            words = road_part.split()
            
            # Skip leading numbers
            while words and words[0].isdigit():
                words.pop(0)
            
            if words:
                return " ".join(words)
        
        return "Unknown Road"
    
    def _get_road_data_for_clients(self, clients: List[ClientData]) -> Dict[str, dict]:
        """Get road data for all clients, using cache when possible"""
        cache = self._load_cache()
        road_data = {}
        uncached_clients = []
        uncached_coordinates = []
        
        # Check cache first
        for client in clients:
            if not client.has_coordinates():
                continue
                
            cache_key = self._cache_key(client.lat, client.lon)  # type: ignore
            
            if cache_key in cache:
                road_data[cache_key] = cache[cache_key]
                print(f"Using cached road data for: {client.name}")
            else:
                uncached_clients.append(client)
                uncached_coordinates.append((client.lat, client.lon))  # type: ignore
        
        # Fetch uncached data
        if uncached_coordinates:
            try:
                print(f"Fetching road data for {len(uncached_coordinates)} clients")
                new_road_data = self._call_roads_api(uncached_coordinates)
                road_data.update(new_road_data)
                
                # Update cache
                cache.update(new_road_data)
                self._save_cache(cache)
                
            except RoadDataError as e:
                print(f"Warning: Roads API failed: {e}")
                # Create fallback data for failed clients
                for client in uncached_clients:
                    cache_key = self._cache_key(client.lat, client.lon)  # type: ignore
                    road_data[cache_key] = {
                        "road_name": "Unknown Road",
                        "road_id": "",
                        "snapped_lat": client.lat,
                        "snapped_lon": client.lon
                    }
        
        return road_data
    
    def _calculate_distance(self, coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        """Calculate approximate distance in meters between two coordinates"""
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        
        # Simple approximation - good enough for short distances
        lat_diff = abs(lat2 - lat1) * 111000  # ~111km per degree latitude
        lon_diff = abs(lon2 - lon1) * 111000 * 0.7  # Rough longitude adjustment
        
        return (lat_diff ** 2 + lon_diff ** 2) ** 0.5
    
    def _should_group_together(
        self, 
        client1: ClientData, 
        client2: ClientData, 
        road_data: Dict[str, dict]
    ) -> bool:
        """Determine if two clients should be in the same group"""
        if not (client1.has_coordinates() and client2.has_coordinates()):
            return False
        
        # Check distance first (quick filter)
        distance = self._calculate_distance(
            (client1.lat, client1.lon),  # type: ignore
            (client2.lat, client2.lon)   # type: ignore
        )
        
        if distance > self.max_walking_distance:
            return False
        
        # Check if on same road
        key1 = self._cache_key(client1.lat, client1.lon)  # type: ignore
        key2 = self._cache_key(client2.lat, client2.lon)  # type: ignore
        
        road1 = road_data.get(key1, {})
        road2 = road_data.get(key2, {})
        
        # Same road = group together
        if road1.get("road_name") == road2.get("road_name") and road1.get("road_name"):
            return True
        
        # Different roads but close to intersection = potential group
        if distance <= self.intersection_tolerance:
            return True
        
        return False
    
    def _calculate_group_metadata(self, clients: List[ClientData], road_data: Dict[str, dict]) -> dict:
        """Calculate metadata for a group of clients"""
        if not clients:
            return {}
        
        # Calculate center point
        total_lat = sum(c.lat for c in clients if c.has_coordinates())  # type: ignore
        total_lon = sum(c.lon for c in clients if c.has_coordinates())  # type: ignore
        valid_clients = [c for c in clients if c.has_coordinates()]
        
        if not valid_clients:
            return {"center_point": (0.0, 0.0)}
        
        center_point = (total_lat / len(valid_clients), total_lon / len(valid_clients))
        
        # Get road name (use most common road name in group)
        road_names = []
        for client in valid_clients:
            key = self._cache_key(client.lat, client.lon)  # type: ignore
            road_info = road_data.get(key, {})
            if road_info.get("road_name"):
                road_names.append(road_info["road_name"])
        
        road_name = max(set(road_names), key=road_names.count) if road_names else None
        
        # Calculate estimated walking distance (sum of distances between consecutive clients)
        walking_distance = 0.0
        if len(valid_clients) > 1:
            for i in range(len(valid_clients) - 1):
                walking_distance += self._calculate_distance(
                    (valid_clients[i].lat, valid_clients[i].lon),      # type: ignore
                    (valid_clients[i + 1].lat, valid_clients[i + 1].lon)  # type: ignore
                )
        
        return {
            "center_point": center_point,
            "road_name": road_name,
            "road_id": road_data.get(self._cache_key(valid_clients[0].lat, valid_clients[0].lon), {}).get("road_id"),  # type: ignore
            "estimated_walking_distance": walking_distance
        }
    
    def group_clients(self, clients: List[ClientData]) -> List[ClientGroup]:
        """Group clients using Google Roads API for street-aware grouping"""
        if not clients:
            return []
        
        # Filter clients with coordinates
        valid_clients = [c for c in clients if c.has_coordinates()]
        invalid_clients = [c for c in clients if not c.has_coordinates()]
        
        if not valid_clients:
            return []
        
        # Get road data for all clients
        try:
            road_data = self._get_road_data_for_clients(valid_clients)
        except Exception as e:
            print(f"Warning: Road data retrieval failed: {e}")
            # Fallback to simple distance grouping
            return self._fallback_distance_grouping(valid_clients)
        
        # Group clients using road-aware algorithm
        groups = []
        ungrouped_clients = valid_clients.copy()
        
        while ungrouped_clients:
            # Start new group with first ungrouped client
            current_group = [ungrouped_clients.pop(0)]
            
            # Find all clients that should be grouped with current group
            i = 0
            while i < len(ungrouped_clients):
                should_add = any(
                    self._should_group_together(group_client, ungrouped_clients[i], road_data)
                    for group_client in current_group
                )
                
                if should_add:
                    current_group.append(ungrouped_clients.pop(i))
                    # Reset search to check if newly added client creates new grouping opportunities
                    i = 0
                else:
                    i += 1
            
            # Create ClientGroup with metadata
            metadata = self._calculate_group_metadata(current_group, road_data)
            group = ClientGroup(
                clients=current_group,
                **metadata
            )
            groups.append(group)
        
        # Add invalid clients as individual groups
        for client in invalid_clients:
            group = ClientGroup(
                clients=[client],
                center_point=(0.0, 0.0),
                road_name=None,
                road_id=None,
                estimated_walking_distance=0.0
            )
            groups.append(group)
        
        return groups
    
    def _fallback_distance_grouping(self, clients: List[ClientData]) -> List[ClientGroup]:
        """Fallback grouping based on simple distance when Roads API fails"""
        print("Using fallback distance-based grouping")
        
        groups = []
        ungrouped_clients = clients.copy()
        
        while ungrouped_clients:
            current_group = [ungrouped_clients.pop(0)]
            
            # Find nearby clients
            i = 0
            while i < len(ungrouped_clients):
                min_distance = min(
                    self._calculate_distance(
                        (group_client.lat, group_client.lon),    # type: ignore
                        (ungrouped_clients[i].lat, ungrouped_clients[i].lon)  # type: ignore
                    )
                    for group_client in current_group
                )
                
                if min_distance <= self.max_walking_distance:
                    current_group.append(ungrouped_clients.pop(i))
                    i = 0  # Reset search
                else:
                    i += 1
            
            # Create group with basic metadata
            if current_group:
                total_lat = sum(c.lat for c in current_group)  # type: ignore
                total_lon = sum(c.lon for c in current_group)  # type: ignore
                center_point = (total_lat / len(current_group), total_lon / len(current_group))
                
                group = ClientGroup(
                    clients=current_group,
                    center_point=center_point,
                    road_name="Unknown (Fallback)",
                    road_id=None,
                    estimated_walking_distance=0.0
                )
                groups.append(group)
        
        return groups


class MockGroupingService(ClientGroupingService):
    """Mock implementation for testing"""
    
    def __init__(self, max_walking_distance: float = 200.0):
        self.max_walking_distance = max_walking_distance
    
    def group_clients(self, clients: List[ClientData]) -> List[ClientGroup]:
        """Simple distance-based grouping for testing"""
        if not clients:
            return []
        
        valid_clients = [c for c in clients if c.has_coordinates()]
        
        # Simple grouping by proximity
        groups = []
        ungrouped = valid_clients.copy()
        
        while ungrouped:
            current_group = [ungrouped.pop(0)]
            
            # Find nearby clients
            i = 0
            while i < len(ungrouped):
                distance = min(
                    self._calculate_distance(
                        (gc.lat, gc.lon),        # type: ignore
                        (ungrouped[i].lat, ungrouped[i].lon)  # type: ignore
                    )
                    for gc in current_group
                )
                
                if distance <= self.max_walking_distance:
                    current_group.append(ungrouped.pop(i))
                    i = 0
                else:
                    i += 1
            
            # Create mock group
            total_lat = sum(c.lat for c in current_group)  # type: ignore
            total_lon = sum(c.lon for c in current_group)  # type: ignore
            center_point = (total_lat / len(current_group), total_lon / len(current_group))
            
            group = ClientGroup(
                clients=current_group,
                center_point=center_point,
                road_name="Mock Street",
                road_id="mock_id",
                estimated_walking_distance=50.0
            )
            groups.append(group)
        
        return groups
    
    def _calculate_distance(self, coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        """Simple distance calculation"""
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        lat_diff = abs(lat2 - lat1) * 111000
        lon_diff = abs(lon2 - lon1) * 111000 * 0.7
        return (lat_diff ** 2 + lon_diff ** 2) ** 0.5


# Factory function for easy service creation
def create_grouping_service(
    api_key: Optional[str] = None,
    cache_file_path: Optional[Path] = None,
    max_walking_distance: float = 200.0,
    intersection_tolerance: float = 50.0,
    use_mock: bool = False
) -> ClientGroupingService:
    """
    Factory function to create appropriate grouping service
    
    Args:
        api_key: Google Maps API key (required if not using mock)
        cache_file_path: Optional cache file path
        max_walking_distance: Maximum walking distance between clients in same group (meters)
        intersection_tolerance: Distance from intersection for cross-street grouping (meters)
        use_mock: If True, returns mock service for testing
        
    Returns:
        Configured grouping service
    """
    if use_mock:
        return MockGroupingService(max_walking_distance)
    
    if not api_key:
        raise ValueError("API key is required for Google Roads grouping service")
    
    return GoogleRoadsGroupingService(
        api_key, 
        cache_file_path, 
        max_walking_distance, 
        intersection_tolerance
    )
