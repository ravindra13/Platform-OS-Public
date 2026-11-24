import os
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.dependencies import services, initialize_core_services
from scripts.seeder import seed_initial_metadata

from api.action_router import router as action_router
from api.query_router import router as query_router
from api.metadata.router import metadata_router
# from api.ledger_router import router as ledger_router
from api.security_router import router as security_router
from api.ai.router import router as ai_router
from api.text_router import router as text_router

from fastapi.staticfiles import StaticFiles

# # Import your capabilities here
# from capabilities.elasticsearch.plugin import ElasticsearchPlugin
from capabilities.inbox.plugin import InboxPlugin
from capabilities.audit.plugin import AuditPlugin
from capabilities.migration.plugin import DataMigrationPlugin
from capabilities.template.plugin import TemplatePlugin
from capabilities.email.plugin import EmailPlugin
from capabilities.pdf.plugin import PdfPlugin
from dotenv import load_dotenv

load_dotenv() # Add this line to read the .env file

POSTGRES_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:1234@localhost:5432/my_erp_db")


# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # # # 1. Initialize Dependency Injection Container
#     await initialize_core_services(POSTGRES_DSN)
#     # # # 2. Seed Default Metadata
#     await seed_initial_metadata(services)
#     # await get_hms_blueprints(services)
#     # await seed_procurement_metadata(services)

#     # # --> FIX: Trigger capability background workers and event subscriptions
#     await services.registry.initialize_all(services)

#     yield  # # Application runs here

#     if services.db_driver:
#         print("[Server] Closing Postgres Connection Pool...")
#         await services.db_driver.close()


# In your server.py, update the lifespan context manager:

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize Dependency Injection Container
    await initialize_core_services(POSTGRES_DSN)
    
    # 2. Trigger capability background workers and event subscriptions
    await services.registry.initialize_all(services)

    # ---> NEW: Register capability-owned schemas dynamically <---
    capability_schemas = services.registry.get_all_schemas()
    for obj_name, schema_definition in capability_schemas.items():
        # Check if it already exists to avoid overwriting user customizations
        existing = await services.schema_engine.get_object_blueprint(obj_name)
        if not existing:
            print(f"[Registry] Seeding capability schema: {obj_name}")
            # Create the object using your native engine
            await services.schema_engine.create_object(
                object_name=obj_name, 
                label=schema_definition.label, 
                enable_rls=getattr(schema_definition, 'enable_rls', True), 
                has_owner=getattr(schema_definition, 'has_owner', True)
            )
            # Add all the fields defined in the capability schema
            for field_def in schema_definition.fields.values():
                if field_def.field_name not in ['Id', 'OwnerId', 'TenantId']: # Skip auto-injected system fields
                    await services.schema_engine.add_field(obj_name, field_def)

    # 3. Seed Default Application Metadata (Roles, Users, etc)
    await seed_initial_metadata(services)

    yield  # Application runs here

    if services.db_driver:
        print("[Server] Closing Postgres Connection...")
        await services.db_driver.close()

app = FastAPI(title="Enterprise ERP Core Engine API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(action_router)
app.include_router(query_router)
app.include_router(metadata_router)
# app.include_router(ledger_router)
app.include_router(security_router)
app.include_router(ai_router)
app.include_router(text_router)
# ## Register them into the global container
# services.registry.register(ElasticsearchPlugin())
services.registry.register(InboxPlugin())
services.registry.register(AuditPlugin())
services.registry.register(DataMigrationPlugin())
services.registry.register(TemplatePlugin())
services.registry.register(EmailPlugin())
services.registry.register(PdfPlugin())


# # --> FIX: Dynamically mount all Capability Plugin routers BEFORE StaticFiles
for plugin_router in services.registry.get_all_routers():
    app.include_router(plugin_router)

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
