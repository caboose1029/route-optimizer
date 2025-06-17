from venv import create
from fastapi import APIRouter, Request, routing
from fastapi.responses import HTMLResponse, JSONResponse
from route_optimizer.models.company import Company
from route_optimizer.services.client_service import ClientService
from route_optimizer.repositories.client_repository import create_client_repository
from route_optimizer.services.geocoding_service import create_geocoding_service
from route_optimizer.services.routing_service import create_routing_service
from route_optimizer.models.client import ClientData
from route_optimizer.config import GOOGLE_API_KEY
from typing import List

router = APIRouter()

# Setup service layer
company = Company("Sample Owner Operator")
client_repository = create_client_repository(company.base_path)
geocoding_service = create_geocoding_service(api_key=GOOGLE_API_KEY)
# routing_service = create_routing_service(api_key=GOOGLE_API_KEY)
routing_service = create_routing_service()
client_service = ClientService(client_repository, geocoding_service)

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
    return client_service.get_all_clients()

@router.get("/routes/geo")
async def get_street_route():
    """
    Get optimized route based on geocoded client addresses.
    """
    clients = client_service.get_all_clients()
    if not clients:
        return JSONResponse(status_code=404, content={"message": "No clients found"})

    locations = [(client.lat, client.lon) for client in clients if client.has_coordinates()]
    
    if not locations:
        return JSONResponse(status_code=404, content={"message": "No valid coordinates found for routing"})

    try:
        optimized_route = routing_service.optimize_route(locations) # type: ignore
        return optimized_route
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
