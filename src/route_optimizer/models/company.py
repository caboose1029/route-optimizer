import json
from pathlib import Path
from typing import Optional
from route_optimizer.config import DATA_PATH

class Company:

    def __init__(self, name: str, id: Optional[str] = None):
        self.name = name.strip()
        self.id = id or self.normalize_name(name)
        self.base_path = DATA_PATH / self.id
        self.paths = self.build_paths()


    def normalize_name(self, name: str) -> str:
        return name.strip().lower().replace(" ", "_")


    def build_paths(self) -> dict:
        return{
            "info" : self.base_path / "company.json",
            "index" : self.base_path / "index",
            "cache" : self.base_path / "cache",
            "clients" : self.base_path / "clients",
            "employees" : self.base_path / "employees",
            "equipment" : self.base_path / "equipment"
        }


    def company_exists(self) -> bool:
        return self.base_path.exists() and self.paths["info"].exists()


    def create_structure(self, overwrite: bool = False):
        if self.company_exists() and not overwrite:
            raise FileExistsError(f"Company '{self.id}' already exists.")
        
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        for key, path in self.paths.items():
            if key != "info":
                path.mkdir(exist_ok=True)


    def save_info(self):
        data = {
            "name" : self.name,
            "id" : self.id
        }
        with open(self.paths["info"], "w") as f:
            json.dump(data, f, indent=2)


    def load_info(self) -> dict:
        if not self.paths["info"].exists():
            raise FileNotFoundError(f"No company.json file found for {self.id}")
        with open(self.paths["info"]) as f:
            return json.load(f)

    
    def get_path(self, key: str) -> Path:
        return self.paths[key]
