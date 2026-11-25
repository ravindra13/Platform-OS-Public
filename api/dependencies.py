# api/dependencies.py






from fastapi import HTTPException, Depends
from runtime.context.context_models import UserContext
from runtime.context.context_hydrator import ContextHydrator
# --> NEW IMPORT: Bring in the Capability Registry
from capabilities.registry import CapabilityRegistry
# Add this import at the top
from runtime.events.event_bus import EventBus # NEW IMPORT

# Assuming you created the file at services/llm_engine.py
from services.llm_engine import LLMEngine




from fastapi import Header
import uuid
from runtime.context.context_models import RequestContext

# --- ENGINE IMPORTS (Moved from server.py) ---
from foundation.storage.postgres_adapter import PostgresDatabaseAdapter
from foundation.metadata.metadata_repository import MetadataRepository
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine
from foundation.metadata.relationship_mapper import RelationshipGraphMapper
from foundation.security.security_repository import SecurityRepository
from foundation.security.security_policy_core import SecurityPolicyCore
from foundation.temporal.immutable_ledger import ImmutableLedgerStore
from foundation.sovereignty.tenant_router import SovereigntyRouter

from runtime.context.request_manager import RequestAndContextManager
from runtime.actionpipeline.database_transaction import DatabaseTransactionManager
from runtime.actionpipeline.action_pipeline import ActionPipelineOrchestrator
from foundation.storage.sql_compiler import PostgresJsonbCompiler
from runtime.query.query_pipeline import QueryPipelineOrchestrator


from runtime.query.query_parser import QueryParser
from runtime.shared.context_builder import ExpressionContextBuilder
# In dependencies.py, right after initializing the EventBus and other services:
from runtime.events.identity_sync_listener import IdentitySyncListener

class ServiceContainer:
    """Global dependency injection container for engine components."""
    def __init__(self):
        self.db_driver = None
        self.meta_repo = None
        self.graph_mapper = None
        self.schema_engine = None
        self.sec_repo = None
        self.security_core = None
        self.ledger_store = None
        self.sovereignty_router = None
        self.req_manager = None
        self.db_manager = None
        self.action_pipeline = None
        self.query_compiler = None
        self.query_parser = None
        self.query_pipeline = None
        self.context_builder = None
        
        # Add this line to attach the engine to the container
        self.llm_engine = LLMEngine()

        self.event_bus = EventBus() # NEW SLOT
        # --> NEW: The Capability Registry acts as the plugin hub
        self.registry = CapabilityRegistry()


services = ServiceContainer()


class ERPContextHydrator(ContextHydrator):
    def __init__(self, security_repo):
        super().__init__(security_repo=security_repo)
        
    async def hydrate(self, tenant_id: str, user_id: str) -> UserContext:
        user = await self.security_repo.get_user(user_id)
        if not user:
            raise HTTPException(status_code=401, detail=f"User '{user_id}' not found.")
        profile = await self.security_repo.get_profile(user.profile_id)
        if not profile:
            raise HTTPException(status_code=401, detail=f"Profile '{user.profile_id}' not found.")

        if user.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="User does not belong to this tenant.")
        
        return UserContext(
            tenant_id=tenant_id,
            user_id=user_id,
            profile_id=user.profile_id,
            cached_object_perms=profile.object_permissions,
            cached_field_perms=profile.field_permissions
        )


async def initialize_core_services(dsn: str) -> None:
    """Factory function to bootstrap the entire ERP engine."""
    print("[Dependencies] Initializing Postgres Pool & Foundation Layer...")
    
    # # 1. Initialize DB
    services.db_driver = await PostgresDatabaseAdapter.create_adapter(dsn)
    
    # # 2. Wire Foundation Services
    services.meta_repo = MetadataRepository(db_adapter=services.db_driver)

    services.graph_mapper = RelationshipGraphMapper()
    services.schema_engine = MetadataSchemaEngine(repository=services.meta_repo, graph_mapper=services.graph_mapper)
    
    # --- ADD THIS LINE ---
    await services.schema_engine.bootstrap_relationships()
    
    services.sec_repo = SecurityRepository(db_adapter=services.db_driver)
    services.security_core = SecurityPolicyCore(repo=services.sec_repo)
    services.ledger_store = ImmutableLedgerStore(db_adapter=services.db_driver)
    services.sovereignty_router = SovereigntyRouter()
    
    # # 3. Wire Runtime Context
    hydrator = ERPContextHydrator(security_repo=services.sec_repo)
    services.req_manager = RequestAndContextManager(hydrator=hydrator)
    services.db_manager = DatabaseTransactionManager(
        ledger_store=services.ledger_store,
        router=services.sovereignty_router,
        db_adapter=services.db_driver
    )
    


    # # 4. Wire Query Engine
    services.query_compiler = PostgresJsonbCompiler()
    services.query_parser = QueryParser(schema_engine=services.schema_engine)
    services.query_pipeline = QueryPipelineOrchestrator(
        security_core=services.security_core,
        router=services.sovereignty_router,
        db_adapter=services.db_driver,
        parser=services.query_parser,
        schema_engine=services.schema_engine
    )
    
    # # 5. Wire Action Engine
    services.context_builder = ExpressionContextBuilder(query_pipeline=services.query_pipeline)
    services.action_pipeline = ActionPipelineOrchestrator(
        schema_engine=services.schema_engine,
        security_core=services.security_core,
        db_manager=services.db_manager,
        event_bus=services.event_bus,
        context_builder=services.context_builder
    )

    # Instantiate the listener with your repository dependencies
    identity_sync = IdentitySyncListener(
        sec_repo=services.sec_repo,
        db_adapter=services.db_manager.db_adapter
    )
    
    # Subscribe it to the generic save event
    services.event_bus.subscribe("ON_RECORD_SAVE", identity_sync.handle_user_saved)
    
    # --- ADD THIS LINE TO SYNC PROFILES ---
    services.event_bus.subscribe("ON_RECORD_SAVE", identity_sync.handle_profile_saved)
    
    print("[Dependencies] Core services successfully wired.")


async def get_request_context(
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...)
) -> RequestContext:
    """FastAPI Dependency to hydrate and wrap the execution context per request."""
    user_context = await services.req_manager.hydrator.hydrate(
        tenant_id=x_tenant_id,
        user_id=x_user_id
    )
    
    return RequestContext(
        user=user_context,
        mode='USER',
        transaction_id=f"REQ-{uuid.uuid4().hex[:8].upper()}"
    )


async def require_system_caller(
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
) -> None:
    """Admin-only gate: SYSTEM mode, and a real user acting in their own tenant."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can perform this action.")
    await services.req_manager.prepare_request(x_tenant_id, x_user_id, [], initial_mode=x_execution_mode)