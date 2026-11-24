from abc import ABC, abstractmethod
from typing import List, Any
from fastapi import APIRouter

class CapabilityPlugin(ABC):
    """Abstract contract for all modular OS capabilities."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the capability."""
        pass

    def get_routers(self) -> List[APIRouter]:
        """Returns FastAPI routers to be automatically mounted."""
        return []
        
    def get_schemas(self) -> dict:
        """
        Returns a dictionary of ObjectDefinitions owned by this capability.
        e.g., {"sys_MessageTemplate": ObjectDefinition(...)}
        """
        return {}

    async def on_startup(self, services: Any) -> None:
        """
        Executes on server boot.
        Use this to inject tools into the container, seed metadata blueprints,
        or subscribe to runtime events via services.event_bus.
        """
        pass