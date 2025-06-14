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
        clients = []
        print(self.clients_path)
        for file in self.clients_path.glob("*.json"):
            with open(file) as f:
                data = json.load(f)
                clients.append(Client(**data))
        return clients

    
    def load_client_by_id(self, client_id: str) -> Optional[Client]:
        file_path = self.clients_path / f"{client_id}.json"
        if not file_path.exists():
            return None
        with open(file_path) as f:
            return Client(**json.load(f))
        
        
    def client_ids(self) -> List[str]:
        return [f.stem for f in self.clients_path.glob("*.json")]


    def get_next_client_id(self) -> str:
        existing_ids = [int(f.stem) for f in self.clients_path.glob("*.json") if f.stem.isdigit()]
        next_id = max(existing_ids, default=0) + 1
        return f"{next_id:05d}"
    
    
    def save_client(self, client: Client):
        file_path = self.clients_path / f"{client.id}.json"
        with open(file_path, "w") as f:
            json.dump(client.model_dump(), f, indent=2)
