from pydantic import BaseModel
from typing import Optional

class ClientData(BaseModel):
    name: str
    address: str
    id: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


    def has_coordinates(self) -> bool:
        return self.lat is not None and self.lon is not None

    def is_complete(self) -> bool:
        return all([self.name, self.address, self.id, self.lat, self.lon])
