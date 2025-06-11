import openrouteservice
from openrouteservice import convert
from route_optimizer.config import ORS_API_KEY
from typing import List, Tuple
import os

client = openrouteservice.Client(key=ORS_API_KEY)

def get_route_geometry(coords: List[Tuple[float, float]]) -> List[List[float]]:
    ors_coords = [(lon, lat) for lat, lon in coords]

    res = client.directions(
        coordinates=ors_coords,
        profile="driving-car",
        format="geojson"
    )

    geometry = res['features'][0]['geometry']['coordinates']

    return [[lat, lon] for lon, lat in geometry]
