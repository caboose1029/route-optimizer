"""
Service Dependencies and Dependency Injection Container

This module handles the creation and wiring of all service dependencies.
It follows the Dependency Inversion Principle by providing a single place
to configure how services are instantiated and connected.
"""

from pathlib import Path
from typing import Optional
from dataclasses import dataclass

from route_optimizer.models.company import Company
from route_optimizer.services.client_service import ClientService
from route_optimizer.repositories.client_repository import create_client_repository
from route_optimizer.services.geocoding_service import create_geocoding_service
from route_optimizer.services.routing_service import create_routing_service
from route_optimizer.services.grouping_service import create_grouping_service
from route_optimizer.config import GOOGLE_API_KEY


@dataclass
class ServiceContainer:
    """
    Container for all application services.
    
    This provides a clean way to access services throughout the application
    while maintaining proper dependency injection patterns.
    """
    client_service: ClientService
    geocoding_service: any # type: ignore
    routing_service: any # type: ignore
    grouping_service: any # type: ignore
    company: Company


def create_service_container(
    company_name: str = "Sample Owner Operator",
    google_api_key: Optional[str] = None,
    use_mock_services: bool = False
) -> ServiceContainer:
    """
    Factory function to create and configure all services.
    
    This is the main dependency injection setup. All service creation
    and wiring happens here, making it easy to:
    - Swap implementations (real vs mock)
    - Configure services consistently
    - Test with different configurations
    
    Args:
        company_name: Name of the company for data organization
        google_api_key: API key for Google services
        use_mock_services: Whether to use mock implementations for testing
        
    Returns:
        Configured ServiceContainer with all dependencies wired
    """
    api_key = google_api_key or GOOGLE_API_KEY
    
    # Create core company structure
    company = Company(company_name)
    
    # Create repository layer
    client_repository = create_client_repository(company.base_path)
    
    # Create service layer
    geocoding_service = create_geocoding_service(
        api_key=api_key,
        use_mock=use_mock_services
    )
    
    routing_service = create_routing_service(
        api_key=api_key if not use_mock_services else None
    )
    
    grouping_service = create_grouping_service(
        api_key=api_key,
        cache_file_path=company.get_path("cache") / "roads_cache.json",
        max_walking_distance=200,
        use_mock=use_mock_services
    )
    
    # Create business logic services
    client_service = ClientService(client_repository, geocoding_service)
    
    return ServiceContainer(
        client_service=client_service,
        geocoding_service=geocoding_service,
        routing_service=routing_service,
        grouping_service=grouping_service,
        company=company
    )


# Global service container (singleton pattern)
_service_container: Optional[ServiceContainer] = None


def get_service_container() -> ServiceContainer:
    """
    Get the global service container instance.
    
    This implements a simple singleton pattern for the service container.
    In more complex applications, you might use proper DI frameworks
    like dependency-injector or FastAPI's dependency injection system.
    """
    global _service_container
    
    if _service_container is None:
        _service_container = create_service_container()
    
    return _service_container


def reset_service_container() -> None:
    """
    Reset the service container (useful for testing).
    """
    global _service_container
    _service_container = None


def configure_service_container(**kwargs) -> ServiceContainer:
    """
    Configure the service container with custom parameters.
    
    This allows you to override default service configuration,
    which is especially useful for testing or different environments.
    """
    global _service_container
    _service_container = create_service_container(**kwargs)
    return _service_container
