from capabilities.base import CapabilityPlugin
from capabilities.audit.service import AuditCapabilityService
from capabilities.audit.router import router

class AuditPlugin(CapabilityPlugin):
    @property
    def name(self) -> str:
        return "audit_ledger"

    async def on_startup(self, services) -> None:
        services.audit_service = AuditCapabilityService(
            security_core=services.security_core,
            ledger_store=services.ledger_store,
            schema_engine=services.schema_engine # <-- ADD THIS LINE
        )

    def get_routers(self) -> list:
        return [router]