from pydantic import BaseModel
from typing import List, Optional, Tuple
from .client import ClientData

class ClientGroup(BaseModel):
    clients: List[ClientData]
    center_point: Tuple[float, float]
    road_name: Optional[str] = None
    road_id: Optional[str] = None
    estimated_walking_distance: Optional[float] = None
