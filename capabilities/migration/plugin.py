# capabilities/migration/plugin.py
from capabilities.base import CapabilityPlugin
from capabilities.migration.service import MigrationCapabilityService
from capabilities.migration.router import router
from capabilities.migration.worker import MigrationWorker

class DataMigrationPlugin(CapabilityPlugin):
    @property
    def name(self) -> str:
        return "data_migration"

    async def on_startup(self, services) -> None:
        # Initialize the service with db_manager for system job tracking
        services.migration_service = MigrationCapabilityService(
            security_core=services.security_core,
            schema_engine=services.schema_engine,
            db_manager=services.db_manager,
            event_bus=services.event_bus 
        )

        # Register the Background Worker
        # Needs db_manager (for jobs), and pipelines (for actual user data)
        worker = MigrationWorker(
            db_manager=services.db_manager,
            schema_engine=services.schema_engine,
            action_pipeline=services.action_pipeline,
            query_pipeline=services.query_pipeline
        )
        
        # Subscribe the worker to the event bus for async execution
        services.event_bus.subscribe("data_migration.import_requested", worker.handle_import_job)
        services.event_bus.subscribe("data_migration.export_requested", worker.handle_export_job)
        
        print("[Migration Plugin] Service and Background Worker initialized.")

    def get_routers(self) -> list:
        return [router]