import json
import requests
from typing import List, Tuple, Optional
from pathlib import Path
from enum import Enum
from route_optimizer.models.company import Company
from route_optimizer.config import GOOGLE_API_KEY, DATA_PATH

class CacheType(str, Enum):
    GEOCODE = "geocode"
    ROUTING = "routing"


class MapManager:
    
    def __init__(self, company: Company) -> None:
        self.company = company
        self.base_path = company.get_path("cache")
        self.cache_paths = self._build_paths()


    def _build_paths(self) -> dict:
        return{
            "geocode": self.base_path / "geocode_cache.json",
            "routing": self.base_path / "routing_cache.json"
        }


    def _get_cache_path(self, cache_type: CacheType) -> Path:
        return self.cache_paths[cache_type]


    def load_cache(self, cache_type: CacheType) -> dict:
        path = self._get_cache_path(cache_type)
        if path.exists():
            return json.loads(path.read_text())
        return {}


    def save_cache(self, cache_type: CacheType, cache_data: dict) -> None:
        path = self._get_cache_path(cache_type)
        path.write_text(json.dumps(cache_data, indent=2))

    
    def get_coordinates(self, address: str) -> Optional[Tuple[float, float]]:
        cache = self.load_cache(CacheType.GEOCODE)
        if address in cache:
            print(f"[Geocode] using cached result for '{address}'")
            return cache[address]
        coords = self._request_geocode(address)
        if coords:
            cache[address] = coords
            self.save_cache(CacheType.GEOCODE, cache)
        return coords
        
        
    def _request_geocode(self, address: str) -> Optional[Tuple[float, float]]:
        params = {
            "address": address,
            "key": GOOGLE_API_KEY
        }
        response = requests.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
        result = response.json()
        if result["status"] == "OK":
            location = result['results'][0]['geometry']['location']
            return (location['lat'], location['lng'])
        print(f"[Geocode] Failed for '{address}': {result['status']}")
        return None
