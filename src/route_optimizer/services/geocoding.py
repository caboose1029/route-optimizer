import requests
import json
import os
import time
from route_optimizer.config import GOOGLE_API_KEY, DATA_PATH

CACHE_FILE = DATA_PATH / "geocode_cache.json"

if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r") as f:
        cache = json.load(f)

else:
    cache = {}

def save_cache():
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)

def geocode_address(address):
    if address in cache:
        print(f"Using cached data for {address}")
        return cache[address]

    base_url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": address,
        "key": GOOGLE_API_KEY
    }

    response = requests.get(base_url, params=params)
    result = response.json()

    if result['status'] == "OK":
        location = result['results'][0]['geometry']['location']
        coords = (location['lat'], location['lng'])
        cache[address] = coords
        save_cache()

    else:
        print(f"Geocoding failed for: {address} - Status: {result['status']}")
    return None, None
