import json
import os
from abc import ABC, abstractmethod
from typing import List, Optional
from pathlib import Path

from route_optimizer.models.client import ClientData


class ClientRepositoryError(Exception):
    """Base exception for client repository operations"""
    pass


class ClientNotFoundError(ClientRepositoryError):
    """Raised when a client cannot be found"""
    pass


class ClientDataCorruptedError(ClientRepositoryError):
    """Raised when client data file is corrupted"""
    pass


class ClientRepository(ABC):
    """Abstract base repository for client operations"""
    
    @abstractmethod
    def get_by_id(self, client_id: str) -> ClientData:
        """Load existing client by ID"""
        pass
    
    @abstractmethod
    def save(self, client_data: ClientData) -> ClientData:
        """Save client, generating ID if needed"""
        pass
    
    @abstractmethod
    def get_all(self) -> List[ClientData]:
        """Load all clients for this company"""
        pass
    
    @abstractmethod
    def exists(self, client_id: str) -> bool:
        """Check if client exists"""
        pass
    
    @abstractmethod
    def delete(self, client_id: str) -> bool:
        """Delete client by ID"""
        pass


class FileClientRepository(ClientRepository):
    """File-based implementation of ClientRepository"""
    
    def __init__(self, company_data_path: Path):
        """
        Initialize repository for a specific company
        
        Args:
            company_data_path: Path to company's data directory
        """
        self.company_path = Path(company_data_path)
        self.clients_path = self.company_path / "clients"
        self._ensure_directory_exists()
    
    def _ensure_directory_exists(self) -> None:
        """Create clients directory if it doesn't exist"""
        self.clients_path.mkdir(parents=True, exist_ok=True)
    
    def _get_client_file_path(self, client_id: str) -> Path:
        """Get file path for a specific client"""
        return self.clients_path / f"{client_id}.json"
    
    def _generate_next_id(self) -> str:
        """Generate next available client ID (5-digit left-padded)"""
        existing_ids = []
        
        if self.clients_path.exists():
            for file_path in self.clients_path.glob("*.json"):
                try:
                    # Extract ID from filename (remove .json extension)
                    client_id = file_path.stem
                    if client_id.isdigit():
                        existing_ids.append(int(client_id))
                except ValueError:
                    # Skip files that don't follow the naming convention
                    continue
        
        next_id = max(existing_ids, default=0) + 1
        return f"{next_id:05d}"  # Left-pad with zeros to 5 digits
    
    def _load_client_data(self, file_path: Path) -> ClientData:
        """Load and validate client data from file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                return ClientData.model_validate(data)
        except json.JSONDecodeError as e:
            raise ClientDataCorruptedError(
                f"Client file {file_path} contains invalid JSON: {e}"
            )
        except Exception as e:
            raise ClientDataCorruptedError(
                f"Failed to load client data from {file_path}: {e}"
            )
    
    def _save_client_data(self, client_data: ClientData) -> None:
        """Save client data to file"""
        file_path = self._get_client_file_path(client_data.id) # type: ignore
        
        try:
            with open(file_path, 'w', encoding='utf-8') as file:
                json.dump(client_data.model_dump(), file, indent=2)
        except Exception as e:
            raise ClientRepositoryError(f"Failed to save client {client_data.id}: {e}")
    
    def get_by_id(self, client_id: str) -> ClientData:
        """Load existing client by ID"""
        file_path = self._get_client_file_path(client_id)
        
        if not file_path.exists():
            raise ClientNotFoundError(f"Client with ID '{client_id}' not found")
        
        return self._load_client_data(file_path)
    
    def save(self, client_data: ClientData) -> ClientData:
        """Save client, generating ID if needed"""
        # Generate ID if not provided
        if not client_data.id:
            client_data = client_data.model_copy(update={'id': self._generate_next_id()})
        
        # Validate that required data is present
        if not client_data.name or not client_data.address:
            raise ClientRepositoryError(
                "Cannot save client: name and address are required"
            )
        
        self._save_client_data(client_data)
        return client_data
    
    def get_all(self) -> List[ClientData]:
        """Load all clients for this company"""
        clients = []
        
        if not self.clients_path.exists():
            return clients
        
        for file_path in self.clients_path.glob("*.json"):
            try:
                client_data = self._load_client_data(file_path)
                clients.append(client_data)
            except ClientDataCorruptedError:
                # Log the error but continue loading other clients
                # In production, you might want to use proper logging here
                print(f"Warning: Skipping corrupted client file: {file_path}")
                continue
        
        # Sort by ID for consistent ordering
        return sorted(clients, key=lambda c: c.id)
    
    def exists(self, client_id: str) -> bool:
        """Check if client exists"""
        file_path = self._get_client_file_path(client_id)
        return file_path.exists()
    
    def delete(self, client_id: str) -> bool:
        """Delete client by ID"""
        file_path = self._get_client_file_path(client_id)
        
        if not file_path.exists():
            return False
        
        try:
            file_path.unlink()
            return True
        except Exception as e:
            raise ClientRepositoryError(f"Failed to delete client {client_id}: {e}")


# Factory function for easy repository creation
def create_client_repository(company_data_path: Path) -> ClientRepository:
    """Factory function to create a client repository"""
    return FileClientRepository(company_data_path)
