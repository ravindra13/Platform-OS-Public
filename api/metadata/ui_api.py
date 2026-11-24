from fastapi import APIRouter, Header, HTTPException
from api.dependencies import services

router = APIRouter()

@router.get("/schema/{object_name}/ui-schema")
async def get_dynamic_ui_schema(
    object_name: str,
    view: str = "list",
    x_user_id: str = Header(...)
):
    blueprint = await services.schema_engine.get_object_blueprint(object_name)
    if not blueprint:
        raise HTTPException(status_code=404, detail=f"Object {object_name} not found.")

    # 1. Calculate Permissions
    can_create = await services.security_core.has_object_access(x_user_id, object_name, 'CREATE')
    can_update = await services.security_core.has_object_access(x_user_id, object_name, 'UPDATE')
    can_delete = await services.security_core.has_object_access(x_user_id, object_name, 'DELETE')

    permissions = {
        "allow_create": can_create,
        "allow_update": can_update,
        "allow_delete": can_delete
    }

    # 2. Return pure metadata. No UI components.
    return {
        "object_name": object_name,
        "label": blueprint.label,
        "fields": blueprint.fields,
        "view_mappings": blueprint.view_mappings,
        "saved_views": getattr(blueprint, 'saved_views', []),
        "capabilities": getattr(blueprint, 'capabilities', []),
        "permissions": permissions,
        "requested_view": view
    }