"""
API Routes for Route Optimizer

This module defines all HTTP endpoints and handles request/response transformation.
Business logic is delegated to appropriate service classes.
"""

from typing import List, Optional
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from route_optimizer.models.client import ClientData
from route_optimizer.services.dependencies import get_service_container
from route_optimizer.config import GOOGLE_API_KEY


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CreateClientRequest(BaseModel):
    """Request model for creating a new client"""
    name: str
    address: str


class ClientResponse(BaseModel):
    """Response model for client data"""
    id: str
    name: str
    address: str
    lat: Optional[float] = None
    lon: Optional[float] = None


class GroupResponse(BaseModel):
    """Response model for client group data"""
    id: int
    client_count: int
    road_name: Optional[str]
    center_point: dict
    walking_distance: float
    clients: List[dict]


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter()

# Get service container (dependency injection)
services = get_service_container()


# ============================================================================
# PAGE ROUTES (HTML)
# ============================================================================

@router.get("/", response_class=HTMLResponse)
async def landing_page(request: Request):
    """Home page"""
    return request.app.templates.TemplateResponse("index.html", {"request": request})


@router.get("/map", response_class=HTMLResponse)
async def map_view(request: Request):
    """Map visualization page"""
    return request.app.templates.TemplateResponse("map.html", {"request": request})


@router.get("/clients", response_class=HTMLResponse)
async def client_view(request: Request):
    """Client management page"""
    return request.app.templates.TemplateResponse(
        "clients.html", 
        {
            "request": request,
            "google_api_key": GOOGLE_API_KEY
        }
    )


# ============================================================================
# CLIENT DATA API ROUTES
# ============================================================================

@router.get("/data", response_model=List[ClientData])
async def get_clients():
    """Get all clients"""
    return services.client_service.get_all_clients()


@router.post("/clients", response_model=ClientResponse)
async def create_client(client_request: CreateClientRequest):
    """Create a new client with geocoding"""
    try:
        new_client = services.client_service.create_client(
            name=client_request.name,
            address=client_request.address
        )
        
        return ClientResponse(
            id=new_client.id,  # type: ignore
            name=new_client.name,
            address=new_client.address,
            lat=new_client.lat,
            lon=new_client.lon
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create client: {str(e)}"
        )


@router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str):
    """Get a specific client by ID"""
    try:
        client = services.client_service.get_client(client_id)
        
        return ClientResponse(
            id=client.id,  # type: ignore
            name=client.name,
            address=client.address,
            lat=client.lat,
            lon=client.lon
        )
        
    except Exception as e:
        raise HTTPException(status_code=404, detail="Client not found")


@router.put("/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, client_request: CreateClientRequest):
    """Update an existing client"""
    try:
        if not services.client_service.client_exists(client_id):
            raise HTTPException(status_code=404, detail="Client not found")
        
        updated_client = services.client_service.update_client_address(
            client_id=client_id,
            new_address=client_request.address
        )
        
        return ClientResponse(
            id=updated_client.id,  # type: ignore
            name=updated_client.name,
            address=updated_client.address,
            lat=updated_client.lat,
            lon=updated_client.lon
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to update client: {str(e)}"
        )


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    """Delete a client"""
    try:
        success = services.client_service.delete_client(client_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Client not found")
        
        return {"message": "Client deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to delete client: {str(e)}"
        )


# ============================================================================
# GROUPING API ROUTES
# ============================================================================

@router.get("/groups")
async def get_client_groups():
    """Get client groups for visualization"""
    try:
        clients = services.client_service.get_clients_with_coordinates()
        
        if not clients:
            return {"groups": []}
        
        groups = services.grouping_service.group_clients(clients)
        
        return {
            "groups": [
                {
                    "id": i,
                    "client_count": len(group.clients),
                    "road_name": group.road_name,
                    "center_point": {
                        "lat": group.center_point[0],
                        "lon": group.center_point[1]
                    },
                    "walking_distance": group.estimated_walking_distance,
                    "clients": [
                        {
                            "id": client.id,
                            "name": client.name,
                            "address": client.address,
                            "lat": client.lat,
                            "lon": client.lon
                        }
                        for client in group.clients
                    ]
                }
                for i, group in enumerate(groups)
            ]
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"error": f"Grouping failed: {str(e)}"}
        )


# ============================================================================
# ROUTING API ROUTES
# ============================================================================

@router.get("/routes/geo")
async def get_street_route():
    """Get optimized route based on geocoded client addresses"""
    try:
        clients = services.client_service.get_all_clients()
        
        if not clients:
            return JSONResponse(
                status_code=404, 
                content={"message": "No clients found"}
            )

        locations = [
            (client.lat, client.lon) 
            for client in clients 
            if client.has_coordinates()
        ]
        
        if not locations:
            return JSONResponse(
                status_code=404, 
                content={"message": "No valid coordinates found for routing"}
            )

        optimized_route = services.routing_service.optimize_route(locations)
        return optimized_route
        
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"message": str(e)}
        )
