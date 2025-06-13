from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse
# from route_optimizer.services.client_data import load_clients
from route_optimizer.models.company import Company
from route_optimizer.services.client_manager import ClientManager
from route_optimizer.models.client import Client
from route_optimizer.services.routing import get_route_geometry
from typing import List

router = APIRouter()

@router.get("/", response_class=HTMLResponse)
async def landing_page(request: Request):
    return request.app.templates.TemplateResponse("index.html", {"request": request})

@router.get("/map", response_class=HTMLResponse)
async def map_view(request: Request):
    return request.app.templates.TemplateResponse("map.html", {"request": request})

@router.get("/clients", response_class=HTMLResponse)
async def client_view(request: Request):
    return request.app.templates.TemplateResponse("clients.html", {"request": request})

@router.get("/data", response_model=List[Client])
async def get_clients():
    company = Company("sample_owner_operator")
    client_manager = ClientManager(company)
    return client_manager.load_all_clients()

@router.get("/routes/geo")
async def get_street_route():
    company = Company("sample_owner_operator")
    client_manager = ClientManager(company)
    clients = client_manager.load_all_clients()
    coords = [(c.lat, c.lon) for c in clients]
    geometry = get_route_geometry(coords)
    return geometry
