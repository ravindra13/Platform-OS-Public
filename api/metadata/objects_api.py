from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from api.dependencies import services
from foundation.core.schema_types import (
    FieldDefinition, FieldType, ReferenceConfig, RelationshipType,
    DeletionBehavior, PicklistConfig, FormulaConfig, RollupConfig, RollupOperation
)
from typing import Optional

router = APIRouter()

class ObjectCreationRequest(BaseModel):
    object_name: str
    label: str

@router.get("/objects")
async def get_accessible_objects(
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    req_context, _ = await services.req_manager.prepare_request(x_tenant_id, x_user_id, [], initial_mode=x_execution_mode)
    all_schemas = await services.meta_repo.get_all_schemas() if hasattr(services.meta_repo, 'get_all_schemas') else []

    accessible_objects = []
    for schema in all_schemas:

        # --- ARCHITECTURE FIX: Separation of Presentation and Security ---
        # If a normal user asks, hide objects not meant for the nav menu.
        # If the SYSTEM (Admin Panel) asks, bypass UI filters to show everything.
        if not schema.show_in_nav and x_execution_mode != 'SYSTEM':
            continue

        has_access = await services.security_core.has_object_access(x_user_id, schema.object_name, 'READ')

        if req_context.mode == 'SYSTEM' or has_access:
            accessible_objects.append({
                "object_name": schema.object_name,
                "label": schema.label,
                # 2. Direct property access for the sidebar views
                "saved_views": schema.saved_views
            })

    return {"objects": accessible_objects}

@router.post("/objects")
async def create_new_object(
    req: ObjectCreationRequest,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM / Admin mode can create objects.")

    try:
        await services.schema_engine.create_object(req.object_name, req.label)
        await services.schema_engine.add_field(req.object_name, FieldDefinition('DisplayId', FieldType.STRING, required=False))
        return {"status": "Success", "message": f"Object '{req.object_name}' created successfully!"}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))

@router.get("/schema/{object_name}")
async def get_object_schema(
    object_name: str,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    blueprint = await services.schema_engine.get_object_blueprint(object_name)
    if not blueprint:
        raise HTTPException(status_code=404, detail=f"Object '{object_name}' not found.")

    # --- ARCHITECTURE PURE: Fetch Object-Level Security (CRUD) ---
    can_create = await services.security_core.has_object_access(x_user_id, object_name, 'CREATE')
    can_update = await services.security_core.has_object_access(x_user_id, object_name, 'UPDATE')
    can_delete = await services.security_core.has_object_access(x_user_id, object_name, 'DELETE')

    fields_info = []
    for field_name, field_def in blueprint.fields.items():
        can_read = await services.security_core.has_field_access(x_user_id, object_name, field_name, 'READ')
        can_update = await services.security_core.has_field_access(x_user_id, object_name, field_name, 'UPDATE')

        if can_read or x_execution_mode == 'SYSTEM':

            # # Safely serialize the config whether it's a TypedDict or a Dataclass
            config_data = field_def.config
            if hasattr(config_data, '__dict__'):
                config_data = config_data.__dict__
            
            fields_info.append({
                "field_name": field_name,
                "data_type": field_def.data_type.value if hasattr(field_def.data_type, 'value') else str(field_def.data_type),
                "required": field_def.required,
                "can_update": can_update or x_execution_mode == 'SYSTEM',
                "config": config_data # <--- NEW: Send the config to the frontend!
            })

    rules_info = [{"rule_id": r.rule_id, "error_condition_expr": r.error_condition_expr, "error_message": r.error_message} for r in getattr(blueprint, 'validation_rules', [])]
    # # NEW: Serialize the flows so the Schema Viewer can render them!
    flows_info = []
    for f in getattr(blueprint, 'flows', []):
        flows_info.append({
            "flow_id": getattr(f, 'flow_id', None) or f.get('flow_id'),
            "trigger_event": getattr(f, 'trigger_event', None) or f.get('trigger_event'),
            "execution_phase": getattr(f, 'execution_phase', 'BEFORE_SAVE') or f.get('execution_phase', 'BEFORE_SAVE'),
            "active": getattr(f, 'active', True) if not isinstance(f, dict) else f.get('active', True),
            "steps": getattr(f, 'steps', []) or f.get('steps', [])
        })

    # # Pass through saved_views and view_mappings from the blueprint directly to the frontend
    return {
        "object_name": object_name,
        "label": blueprint.label,

        # # Pass the CRUD matrix down to the UI!
        "object_permissions": {
            "allow_create": can_create or x_execution_mode == 'SYSTEM',
            "allow_update": can_update or x_execution_mode == 'SYSTEM',
            "allow_delete": can_delete or x_execution_mode == 'SYSTEM'
        },
        "fields": fields_info,
        "validation_rules": rules_info,
        "flows": flows_info,
        "saved_views": getattr(blueprint, 'saved_views', []),
        "view_mappings": getattr(blueprint, 'view_mappings', {}),
        "capabilities": getattr(blueprint, 'capabilties', []),
    }

# --- ADD NEW FIELD ROUTE ---

class FieldCreationRequest(BaseModel):
    field_name: str
    data_type: str
    required: bool = False

    # # REFERENCE / LOOKUP fields
    target_object: Optional[str] = None
    relationship_type: Optional[str] = "LOOKUP"
    deletion_behavior: Optional[str] = "RESTRICT"
    filter_expression: Optional[str] = None # <-- Added for Lookup Filters

    # # Picklist fields (NEW)
    allowed_values: Optional[list[str]] = None

    # # FORMULA fields
    expression: Optional[str] = None

    # # ROLLUP_SUMMARY fields
    child_object: Optional[str] = None
    relationship_field: Optional[str] = None
    operation: Optional[str] = None # SUM, COUNT, MIN, MAX
    target_field: Optional[str] = None

@router.post("/schema/{object_name}/field")
async def add_object_field(
    object_name: str,
    req: FieldCreationRequest,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    """Dynamically attaches a new field (including Lookups) to an object blueprint."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM / Admin mode can create fields.")

    try:
        # # Convert string to Enum
        field_type_enum = FieldType[req.data_type.upper()]

        # # Build configuration for Reference fields
        config = None
        if field_type_enum == FieldType.REFERENCE:
            if not req.target_object:
                raise ValueError("target_object is required for REFERENCE fields.")

            config = ReferenceConfig(
                target_object=req.target_object,
                relationship_type=RelationshipType[req.relationship_type.upper()],
                deletion_behavior=DeletionBehavior[req.deletion_behavior.upper()],
                filter_expression=req.filter_expression
            )
        # # Build configuration for Picklist fields (NEW)
        elif field_type_enum == FieldType.PICKLIST:
            if not req.allowed_values or len(req.allowed_values) == 0:
                raise ValueError("allowed_values list is required for PICKLIST fields.")

            config = PicklistConfig(allowed_values=req.allowed_values)
        elif field_type_enum == FieldType.FORMULA:
            if not req.expression:
                raise ValueError("expression is required for FORMULA fields.")
            config = FormulaConfig(expression=req.expression)

        elif field_type_enum == FieldType.ROLLUP_SUMMARY:
            if not req.child_object or not req.relationship_field or not req.operation:
                raise ValueError("child_object, relationship_field, and operation are required for ROLLUP_SUMMARY fields.")
            config = RollupConfig(
                child_object=req.child_object,
                relationship_field=req.relationship_field,
                operation=RollupOperation[req.operation.upper()],
                target_field=req.target_field,
                filter_expression=req.filter_expression # Rollups can also have filters
            )

        # # Build the dataclass
        field_def = FieldDefinition(
            field_name=req.field_name,
            data_type=field_type_enum,
            required=req.required,
            config=config
        )

        # # Save it to the JSONB Blueprint
        await services.schema_engine.add_field(object_name, field_def)
        return {"status": "Success", "message": f"Field '{req.field_name}' securely added to '{object_name}'."}

    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid type provided: {str(e)}")
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))

class FieldUpdateRequest(BaseModel):
    required: Optional[bool] = None
    # Future-proofing: add config updates here later if needed

@router.put("/schema/{object_name}/field/{field_name}")
async def update_object_field(
    object_name: str,
    field_name: str,
    req: FieldUpdateRequest,
    x_execution_mode: str = Header("USER")
):
    """Admin endpoint to modify an existing field configuration."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can modify schema.")

    try:
        # Delegate directly to the schema engine
        await services.schema_engine.update_field(
            object_name=object_name,
            field_name=field_name,
            required=req.required
        )
        return {"status": "success", "message": f"Field '{field_name}' updated on '{object_name}'."}
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))

# from typing import Optional, List, Dict, Any
# class ViewUpdateRequest(BaseModel):
#     is_system_layout: bool
#     layout_name: Optional[str] = None  # e.g., 'list', 'kanban' (for system views)
#     view_id: Optional[str] = None      # e.g., 'VIEW_CRITICAL' (for custom views)
#     tab_label: Optional[str] = None
#     view_type: Optional[str] = None
#     visible_to_roles: Optional[List[str]] = None
#     config: Dict[str, Any]  # The raw JSON containing columns, filters, card_fields, etc.

# @router.put("/schema/{object_name}/view")
# async def update_object_view(
#     object_name: str,
#     req: ViewUpdateRequest,
#     x_tenant_id: str = Header(...),
#     x_user_id: str = Header(...),
#     x_execution_mode: str = Header("USER")
# ):
#     """Creates or updates a View or System Layout for an object blueprint."""
#     if x_execution_mode != 'SYSTEM':
#         raise HTTPException(status_code=403, detail="Only SYSTEM mode can modify views.")

#     try:
#         # Note: You will need to ensure these two methods exist in your schema_engine!
#         if req.is_system_layout:
#             if not req.layout_name:
#                 raise ValueError("layout_name is required for system layouts.")

#             await services.schema_engine.update_system_layout(
#                 object_name=object_name,
#                 layout_name=req.layout_name,
#                 layout_config=req.config
#             )
        
#             message = f"System layout '{req.layout_name}' updated on '{object_name}'."

#         else:
#             if not req.view_id:
#                 raise ValueError("view_id is required for custom views.")

#             await services.schema_engine.upsert_custom_view(
#                 object_name=object_name,
#                 view_id=req.view_id,
#                 tab_label=req.tab_label,
#                 view_type=req.view_type,
#                 visible_to_roles=req.visible_to_roles,
#                 view_config=req.config
#             )
#             message = f"Custom view '{req.view_id}' saved on '{object_name}'."

#         return {"status": "success", "message": message}

#     except Exception as err:
#         raise HTTPException(status_code=400, detail=str(err))

# Add this near your other Pydantic imports
from typing import Optional, List, Dict, Any

class SystemLayoutUpdateRequest(BaseModel):
    layout_name: str
    config: Dict[str, Any]

class CustomViewUpdateRequest(BaseModel):
    view_id: str
    tab_label: Optional[str] = None
    view_type: Optional[str] = None
    visible_to_roles: Optional[List[str]] = None
    config: Dict[str, Any]

@router.put("/schema/{object_name}/system_layout")
async def update_system_layout_route(
    object_name: str,
    req: SystemLayoutUpdateRequest,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    """Updates a Core System Layout (e.g., default list, kanban, detail) in view_mappings."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can modify views.")

    try:
        await services.schema_engine.update_system_layout(
            object_name=object_name,
            layout_name=req.layout_name,
            layout_config=req.config
        )
        return {"status": "success", "message": f"System layout '{req.layout_name}' updated on '{object_name}'."}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))

@router.put("/schema/{object_name}/custom_view")
async def create_custom_view_route(
    object_name: str,
    req: CustomViewUpdateRequest,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    """Creates or updates a Custom User View in saved_views."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can modify views.")

    try:
        await services.schema_engine.upsert_custom_view(
            object_name=object_name,
            view_id=req.view_id,
            tab_label=req.tab_label,
            view_type=req.view_type,
            visible_to_roles=req.visible_to_roles,
            view_config=req.config
        )
        return {"status": "success", "message": f"Custom view '{req.view_id}' saved on '{object_name}'."}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))

@router.delete("/schema/{object_name}")
async def delete_object(
    object_name: str,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    """Triggers the phase-gated deletion of an entire object blueprint and its physical data."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM / Admin mode can delete objects.")

    try:
        await services.schema_engine.delete_object(object_name)
        return {"status": "Success", "message": f"Object '{object_name}' and all associated records have been deleted."}
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(err)}")


@router.delete("/schema/{object_name}/field/{field_name}")
async def delete_object_field(
    object_name: str,
    field_name: str,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    """Triggers the phase-gated deletion of a specific field from an object blueprint."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM / Admin mode can delete fields.")

    try:
        await services.schema_engine.delete_field(object_name, field_name)
        return {"status": "Success", "message": f"Field '{field_name}' successfully removed from '{object_name}'."}
    except ValueError as err:
        # Catches the Validation Rule and RESTRICT dependency blocks from the engine
        raise HTTPException(status_code=400, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(err)}")