import json
from pathlib import Path
from route_optimizer.models.client import Client
from route_optimizer.services.geocoding import geocode_address
from route_optimizer.config import DATA_PATH
from typing import List

client_data = DATA_PATH / "clients.json"

def load_clients() -> List[Client]:
    with open(client_data) as f:
        raw = json.load(f)

    updated = False

    for entry in raw:
        if entry.get("lat") is None or entry.get("lon") is None:
            lat, lon = geocode_address(entry["address"])
            if lat is not None and lon is not None:
                entry["lat"] = lat
                entry["lon"] = lon
                updated = True

    if updated:
        with open(client_data, "w") as f:
            json.dump(raw, f, indent=2)

    return [Client(**entry) for entry in raw]
