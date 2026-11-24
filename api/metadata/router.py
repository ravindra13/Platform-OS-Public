from fastapi import APIRouter
from . import objects_api, rules_api, flows_api, ui_api
from api import orchestrator_api

# Create the master metadata router
metadata_router = APIRouter(prefix="/api/metadata", tags=["Metadata Discovery"])

# Include the smaller sub-routers
metadata_router.include_router(objects_api.router)
metadata_router.include_router(rules_api.router)
metadata_router.include_router(flows_api.router)
metadata_router.include_router(orchestrator_api.router)
metadata_router.include_router(ui_api.router)
