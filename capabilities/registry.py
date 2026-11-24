from typing import Dict, List
from fastapi import APIRouter
from capabilities.base import CapabilityPlugin

class CapabilityRegistry:
    def __init__(self):
        self._plugins: Dict[str, CapabilityPlugin] = {}

    def register(self, plugin: CapabilityPlugin) -> None:
        if plugin.name in self._plugins:
            print(f"[Registry] Capability '{plugin.name}' is already registered. Skipping.")
            return # Gracefully handle Uvicorn double-execution

        self._plugins[plugin.name] = plugin
        print(f"[Registry] Plugged in capability: {plugin.name}")

    async def initialize_all(self, services) -> None:
        for plugin in self._plugins.values():
            await plugin.on_startup(services)

    def get_all_routers(self) -> List[APIRouter]:
        routers = []
        for plugin in self._plugins.values():
            routers.extend(plugin.get_routers())
        return routers
        
    def get_all_schemas(self) -> dict:
        """Aggregates schemas from all registered plugins."""
        schemas = {}
        for plugin in self._plugins.values():
            schemas.update(plugin.get_schemas())
        return schemas