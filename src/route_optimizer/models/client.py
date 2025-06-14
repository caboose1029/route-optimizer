from pydantic import BaseModel
from typing import Optional

class Client(BaseModel):
    id: str
    name: str
    lat: Optional[float]
    lon: Optional[float]
    address: Optional[str] = None
    yard_size_sqft: Optional[float] = None
    service_time_minutes: Optional[int] = None
    hourly_income: Optional[float] = None
    days_since_last_mow: Optional[int] = None
    priority: Optional[int] = 0
