import json
import requests
from pydantic import BaseModel
from typing import Optional
from route_optimizer.models.company import Company

class ClientData(BaseModel):
    id: str
    name: str
    lat: Optional[float]
    lon: Optional[float]
    address: Optional[str] = None
    yard_size_sqft: Optional[float] = None
    service_time_minutes: Optional[int] = None
    hourly_income: Optional[float] = None
    days_since_last_mow: Optional[int] = None
    priority: Optional[int] = 0


class Client:

    def __init__(self, company: Company, client_id: str) -> None:
        self.company = company
        self.client_id = client_id
        self.client_path = company.get_path("clients") / f"{client_id}.json"
        self.geocode_cache_path = company.get_path("cache") / "geocode_cache.json"
        self.data = self._load_data()

        
    def _load_data(self) -> ClientData:
        with open(self.client_path, "r") as f:
            return ClientData(**json.load(f))

            
    def save(self) -> None:
        with open(self.client_path, "w") as f:
            json.dump(self.data.model_dump(), f, indent=2)


    def id(self) -> str:
        return self.data.id
            
    def name(self) -> str:
        return self.data.name
    
    
    def address(self) -> Optional[str]:
        return self.data.address
    
    
    def coordinates(self) -> Optional[tuple[float, float]]:
        if self.data.lat is not None and self.data.lon is not None:
            return (self.data.lat, self.data.lon)
        return None

    
    def _load_geocode_cache(self) -> dict:
        if self.geocode_cache_path.exists():
            with open(self.geocode_cache_path, "r") as f:
                return(json.load(f))
        return {}

        
    def _save_geocode_cache(self, cache: dict) -> None:
        with open(self.geocode_cache_path, "w") as f:
            json.dump(cache, f, indent=2)

            
    def _geocode_address(self, address: str) -> Optional[tuple[float, float]]:
        from route_optimizer.config import GOOGLE_API_KEY
        base_url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": address, "key": GOOGLE_API_KEY}
        response = requests.get(base_url, params=params)
        result = response.json()
        if result['status'] == "OK":
            location = result['results'][0]['geometry']['location']
            return location['lat'], location['lng']
        return None

        
    def ensure_coordinates(self) -> None:
        if self.coordinates() is not None or not self.address():
            return

        cache = self._load_geocode_cache()
        if self.address() in cache:
            print(f"Using cached coordinates for: {self.address()}")
            self.data.lat, self.data.lon = cache[self.address()]
        else:
            print(f"Geocoding: {self.address()}")
            coords = self._geocode_address(self.address()) # type: ignore
            if coords:
                self.data.lat, self.data.lon = coords
                cache[self.address()] = coords
                self._save_geocode_cache(cache)
                
        self.save()
