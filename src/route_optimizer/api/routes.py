from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse
from route_optimizer.services.client_data import load_clients
from route_optimizer.models.client import Client
from route_optimizer.services.routing import get_route_geometry
from typing import List

router = APIRouter()

@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return request.app.templates.TemplateResponse("index.html", {"request": request})


@router.get("/clients", response_model=List[Client])
async def get_clients():
    return load_clients()

@router.get("/routes/geo")
async def get_street_route():
    clients = load_clients()
    coords = [(c.lat, c.lon) for c in clients]
    geometry = get_route_geometry(coords)
    return geometry
