from typing import List, Optional
from route_optimizer.models.client import ClientData
from route_optimizer.repositories.client_repository import ClientRepository, ClientNotFoundError
from route_optimizer.services.geocoding_service import GeocodingService


class ClientServiceError(Exception):
    """Base exception for client service operations"""
    pass


class InvalidClientDataError(ClientServiceError):
    """Raised when client data cannot be processed"""
    pass


class ClientService:
    """Service layer for client business logic and orchestration"""
    
    def __init__(
        self, 
        client_repository: ClientRepository,
        geocoding_service: GeocodingService
    ):
        self.client_repo = client_repository
        self.geocoding_service = geocoding_service
    
    def create_client(self, name: str, address: str) -> ClientData:
        """
        Create a new client with complete data validation and enrichment
        
        Args:
            name: Client name
            address: Client address
            
        Returns:
            Complete ClientData with generated ID and coordinates
            
        Raises:
            InvalidClientDataError: If address cannot be geocoded or data is invalid
        """
        # Create initial client data
        raw_client_data = ClientData(name=name, address=address)
        
        try:
            # Enrich with geocoding
            geocoded_data = self.geocoding_service.enrich(raw_client_data)
            
            # Save to repository (which will generate ID)
            saved_client = self.client_repo.save(geocoded_data)
            
            return saved_client
            
        except Exception as e:
            raise InvalidClientDataError(
                f"Could not create client with address '{address}': {str(e)}"
            )
    
    def get_client(self, client_id: str) -> ClientData:
        """Get client by ID"""
        return self.client_repo.get_by_id(client_id)
    
    def get_all_clients(self) -> List[ClientData]:
        """Get all clients for the company"""
        return self.client_repo.get_all()
    
    def update_client_address(self, client_id: str, new_address: str) -> ClientData:
        """
        Update client address and re-geocode
        
        Args:
            client_id: ID of client to update
            new_address: New address
            
        Returns:
            Updated ClientData with new coordinates
        """
        try:
            # Get existing client
            existing_client = self.client_repo.get_by_id(client_id)
            
            # Update address and clear coordinates (to force re-geocoding)
            updated_data = existing_client.model_copy(
                update={
                    'address': new_address,
                    'lat': None,
                    'lon': None
                }
            )
            
            # Re-geocode
            geocoded_data = self.geocoding_service.enrich(updated_data)
            
            # Save updated data
            saved_client = self.client_repo.save(geocoded_data)
            
            return saved_client
            
        except ClientNotFoundError:
            raise
        except Exception as e:
            raise InvalidClientDataError(
                f"Could not update client {client_id} with address '{new_address}': {str(e)}"
            )
    
    def delete_client(self, client_id: str) -> bool:
        """Delete client by ID"""
        return self.client_repo.delete(client_id)
    
    def client_exists(self, client_id: str) -> bool:
        """Check if client exists"""
        return self.client_repo.exists(client_id)
    
    def get_clients_with_coordinates(self) -> List[ClientData]:
        """Get all clients that have valid coordinates (for mapping)"""
        all_clients = self.get_all_clients()
        return [client for client in all_clients if client.has_coordinates()]
    
    def validate_client_data_integrity(self) -> List[str]:
        """
        Check all clients for data integrity issues
        
        Returns:
            List of client IDs with missing or invalid coordinate data
        """
        problem_clients = []
        all_clients = self.get_all_clients()
        
        for client in all_clients:
            if not client.has_coordinates():
                problem_clients.append(client.id)
        
        return problem_clients
    
    def repair_client_coordinates(self, client_id: str) -> ClientData:
        """
        Re-geocode a client that has missing coordinates
        
        Args:
            client_id: ID of client to repair
            
        Returns:
            Client with repaired coordinates
        """
        existing_client = self.client_repo.get_by_id(client_id)
        
        if existing_client.has_coordinates():
            return existing_client
        
        try:
            # Re-geocode using existing address
            geocoded_data = self.geocoding_service.enrich(existing_client)
            saved_client = self.client_repo.save(geocoded_data)
            return saved_client
            
        except Exception as e:
            raise InvalidClientDataError(
                f"Could not repair coordinates for client {client_id}: {str(e)}"
            )
