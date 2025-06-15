from typing import List, Optional
from route_optimizer.models.client import Client
import requests
import polyline
from route_optimizer.config import GOOGLE_API_KEY


class MapManager:
    def __init__(self, clients: List[Client]):
        self.clients = clients

    def geocode_all_clients(self) -> None:
        for client in self.clients:
            client.ensure_coordinates()

    def get_route_coordinates(self) -> Optional[List[List[float]]]:
        # Ensure all clients have coordinates
        coords = [client.coordinates() for client in self.clients if client.coordinates()]
        if len(coords) < 2:
            return None

        base_url = "https://maps.googleapis.com/maps/api/directions/json"
        origin = f"{coords[0][0]},{coords[0][1]}" # type: ignore
        destination = f"{coords[-1][0]},{coords[-1][1]}" # type: ignore
        waypoints = "|".join(f"{lat},{lon}" for lat, lon in coords[1:-1]) # type: ignore

        params = {
            "origin": origin,
            "destination": destination,
            "waypoints": waypoints,
            "key": GOOGLE_API_KEY
        }

        response = requests.get(base_url, params=params)
        result = response.json()

        if result["status"] != "OK":
            print("Routing error:", result.get("error_message", "Unknown error"))
            return None

        encoded_polyline = result["routes"][0]["overview_polyline"]["points"]
        return polyline.decode(encoded_polyline)  # type: ignore
