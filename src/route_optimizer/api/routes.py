from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse
from route_optimizer.models.company import Company
from route_optimizer.services.client_manager import ClientManager
from route_optimizer.services.map_manager import MapManager
from route_optimizer.models.client import Client, ClientData
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

@router.get("/data", response_model=List[ClientData])
async def get_clients():
    company = Company("sample_owner_operator")
    client_manager = ClientManager(company)
    return [client.data for client in client_manager.load_all_clients()]

@router.get("/routes/geo")
async def get_street_route():
    company = Company("sample_owner_operator")
    clients = ClientManager(company).load_all_clients()
    map_manager = MapManager(clients)
    map_manager.geocode_all_clients()
    geometry = map_manager.get_route_coordinates()
    return geometry
