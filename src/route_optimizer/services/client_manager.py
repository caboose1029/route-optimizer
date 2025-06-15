from http import client
import json
from pathlib import Path
from typing import List, Optional
from route_optimizer.models.client import Client
from route_optimizer.models.company import Company

class ClientManager:
    
    def __init__(self, company: Company):
        self.company = company
        self.clients_path = self.company.get_path("clients")


    def load_all_clients(self) -> List[Client]:
        return [Client(self.company, file.stem) for file in self.clients_path.glob("*.json")]

    
    def load_client_by_id(self, client_id: str) -> Optional[Client]:
        file_path = self.clients_path / f"{client_id}.json"
        return Client(self.company, client_id) if file_path.exists() else None

            
    def load_clients_by_list(self, ids: list[str]) -> List[Client]:
        return [
            Client(self.company, client_id)
            for client_id in ids
            if (client := self.load_client_by_id(client_id)) is not None
        ]
        
        
    def client_ids(self) -> List[str]:
        return [f.stem for f in self.clients_path.glob("*.json")]


    def get_next_client_id(self) -> str:
        existing_ids = [int(f.stem) for f in self.clients_path.glob("*.json") if f.stem.isdigit()]
        next_id = max(existing_ids, default=0) + 1
        return f"{next_id:05d}"
    
    
    def save_client(self, client: Client) -> None:
        client.save()
