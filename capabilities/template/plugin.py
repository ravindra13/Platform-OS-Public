from capabilities.base import CapabilityPlugin
from capabilities.template.service import TemplateCapabilityService
from capabilities.template.router import router
from capabilities.template.schema import get_template_schemas # <-- NEW IMPORT

class TemplatePlugin(CapabilityPlugin):
    @property
    def name(self) -> str:
        return "template"

    async def on_startup(self, services) -> None:
        services.template_service = TemplateCapabilityService(
            db_manager=services.db_manager
        )
        print("[Template Plugin] Service initialized.")

    def get_routers(self) -> list:
        return [router]

    # <-- NEW METHOD -->
    def get_schemas(self) -> dict:
        return get_template_schemas()