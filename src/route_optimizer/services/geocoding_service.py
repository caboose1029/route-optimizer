import json
import requests
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Tuple
from route_optimizer.models.client import ClientData


class GeocodingError(Exception):
    """Base exception for geocoding operations"""
    pass


class AddressNotFoundError(GeocodingError):
    """Raised when an address cannot be geocoded"""
    pass


class GeocodingService(ABC):
    """Abstract base class for geocoding services"""
    
    @abstractmethod
    def geocode_address(self, address: str) -> Tuple[float, float]:
        """
        Convert address to coordinates
        
        Args:
            address: Street address to geocode
            
        Returns:
            Tuple of (latitude, longitude)
            
        Raises:
            AddressNotFoundError: If address cannot be geocoded
        """
        pass
    
    def enrich(self, client_data: ClientData) -> ClientData:
        """
        Enrich ClientData with coordinates if missing
        
        Args:
            client_data: ClientData that may be missing coordinates
            
        Returns:
            ClientData with coordinates populated
            
        Raises:
            AddressNotFoundError: If address cannot be geocoded
        """
        if client_data.has_coordinates():
            return client_data
        
        if not client_data.address:
            raise GeocodingError("Cannot geocode: address is required")
        
        lat, lon = self.geocode_address(client_data.address)
        
        return client_data.model_copy(update={'lat': lat, 'lon': lon})


class GoogleGeocodingService(GeocodingService):
    """Google Maps API implementation of geocoding service"""
    
    def __init__(self, api_key: str, cache_file_path: Optional[Path] = None):
        """
        Initialize Google geocoding service
        
        Args:
            api_key: Google Maps API key
            cache_file_path: Optional path to cache file for storing results
        """
        self.api_key = api_key
        self.cache_file_path = cache_file_path or Path("geocode_cache.json")
        self.base_url = "https://maps.googleapis.com/maps/api/geocode/json"
    
    def _load_cache(self) -> dict:
        """Load geocoding cache from file"""
        if self.cache_file_path.exists():
            try:
                with open(self.cache_file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                # If cache is corrupted, start fresh
                return {}
        return {}
    
    def _save_cache(self, cache: dict) -> None:
        """Save geocoding cache to file"""
        try:
            # Ensure directory exists
            self.cache_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.cache_file_path, "w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2)
        except IOError as e:
            # Log the error but don't fail the geocoding operation
            print(f"Warning: Could not save geocoding cache: {e}")
    
    def _call_google_api(self, address: str) -> Tuple[float, float]:
        """Make API call to Google Geocoding service"""
        params = {
            "address": address,
            "key": self.api_key
        }
        
        try:
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()  # Raise exception for HTTP errors
            
            result = response.json()
            
            if result['status'] == "OK" and result['results']:
                location = result['results'][0]['geometry']['location']
                return location['lat'], location['lng']
            elif result['status'] == "ZERO_RESULTS":
                raise AddressNotFoundError(f"Address not found: '{address}'")
            else:
                raise GeocodingError(f"Google API error: {result['status']}")
                
        except requests.RequestException as e:
            raise GeocodingError(f"Network error during geocoding: {e}")
        except KeyError as e:
            raise GeocodingError(f"Unexpected API response format: {e}")
    
    def geocode_address(self, address: str) -> Tuple[float, float]:
        """
        Geocode address using Google Maps API with caching
        
        Args:
            address: Street address to geocode
            
        Returns:
            Tuple of (latitude, longitude)
            
        Raises:
            AddressNotFoundError: If address cannot be found
            GeocodingError: If API call fails
        """
        if not address or not address.strip():
            raise GeocodingError("Address cannot be empty")
        
        # Normalize address for cache key (lowercase, stripped)
        cache_key = address.strip().lower()
        
        # Check cache first
        cache = self._load_cache()
        if cache_key in cache:
            print(f"Using cached coordinates for: {address}")
            return tuple(cache[cache_key])
        
        # Make API call
        print(f"Geocoding: {address}")
        coordinates = self._call_google_api(address)
        
        # Save to cache
        cache[cache_key] = coordinates
        self._save_cache(cache)
        
        return coordinates


class MockGeocodingService(GeocodingService):
    """Mock geocoding service for testing"""
    
    def __init__(self, mock_results: Optional[dict] = None):
        """
        Initialize mock service
        
        Args:
            mock_results: Dict mapping addresses to (lat, lon) tuples
        """
        self.mock_results = mock_results or {
            "123 main st": (40.7128, -74.0060),  # NYC coords
            "invalid address": None  # Will raise AddressNotFoundError
        }
    
    def geocode_address(self, address: str) -> Tuple[float, float]:
        """Mock geocoding that returns predefined results"""
        cache_key = address.strip().lower()
        
        if cache_key in self.mock_results:
            result = self.mock_results[cache_key]
            if result is None:
                raise AddressNotFoundError(f"Mock: Address not found: '{address}'")
            return result
        
        # Default mock coordinates if address not in predefined results
        return (40.0, -74.0)


# Factory function for easy service creation
def create_geocoding_service(
    api_key: Optional[str] = None, 
    cache_file_path: Optional[Path] = None,
    use_mock: bool = False
) -> GeocodingService:
    """
    Factory function to create appropriate geocoding service
    
    Args:
        api_key: Google Maps API key (required if not using mock)
        cache_file_path: Optional cache file path
        use_mock: If True, returns mock service for testing
        
    Returns:
        Configured geocoding service
    """
    if use_mock:
        return MockGeocodingService()
    
    if not api_key:
        raise ValueError("API key is required for Google geocoding service")
    
    return GoogleGeocodingService(api_key, cache_file_path)
