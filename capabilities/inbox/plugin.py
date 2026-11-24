from capabilities.base import CapabilityPlugin
from capabilities.inbox.service import InboxCapabilityService
from capabilities.inbox.router import router

class InboxPlugin(CapabilityPlugin):
    @property
    def name(self) -> str:
        return "inbox"

    async def on_startup(self, services) -> None:
        # Instantiate the service using the core engine managers
        # Attach it dynamically to the global services container
        services.inbox_service = InboxCapabilityService(
            security_core=services.security_core,
            db_manager=services.db_manager,
            event_bus=services.event_bus
        )
        print("[Inbox Plugin] Service initialized.")

    def get_routers(self) -> list:
        return [router]
