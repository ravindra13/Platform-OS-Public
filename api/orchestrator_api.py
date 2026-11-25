from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from api.dependencies import services, require_system_caller
from foundation.core.schema_types import (
    FieldType, FieldDefinition, ReferenceConfig,
    RelationshipType, DeletionBehavior, PicklistConfig, ValidationRuleDefinition,
    FormulaConfig, RollupConfig, RollupOperation, FlowDefinition, FlowStepDefinition
)
from foundation.core.security_types import ObjectPermission, FieldPermission

from foundation.flow.flow_parser import FlowParser

# This router now handles traditional package imports
router = APIRouter(prefix="/orchestrate", tags=["App Deployment"])

async def deploy_manifest(app_data: Dict[str, Any]) -> Dict[str, Any]:
    admin_profile = await services.sec_repo.get_profile('PROF-ADMIN')
    created_objects = []
    deployment_errors = [] 

    # --- PASS 1: Base Objects and Primitives ---
    for obj in app_data.get("objects", []):
        object_name = obj["object_name"]
        
        try:
            await services.schema_engine.create_object(object_name, obj.get("label", object_name))
            admin_profile.object_permissions[object_name] = ObjectPermission(
                allow_create=True, allow_read=True, allow_update=True, allow_delete=True
            )
            created_objects.append(object_name)
        except ValueError as e:
            if "already exists" not in str(e).lower():
                deployment_errors.append(f"Failed to create object '{object_name}': {str(e)}")

        for field in obj.get("fields", []):
            field_name = field["field_name"]
            try:
                field_type = FieldType[field["data_type"].upper()]
            except KeyError:
                deployment_errors.append(f"Invalid data type '{field['data_type']}' on {object_name}.{field_name}")
                continue
                
            if field_type in (FieldType.REFERENCE, FieldType.ROLLUP_SUMMARY):
                continue
                
            config = None
            if field_type == FieldType.PICKLIST:
                config = PicklistConfig(allowed_values=field.get("allowed_values", []))
            elif field_type == FieldType.FORMULA:
                config = FormulaConfig(expression=field.get("expression", ""), return_type=field.get("return_type", "STRING"))
                
            field_def = FieldDefinition(field_name=field_name, data_type=field_type, required=field.get("required", False), config=config)
            
            try:
                await services.schema_engine.add_field(object_name, field_def)
                admin_profile.field_permissions[f"{object_name}.{field_name}"] = FieldPermission(allow_read=True, allow_update=True)
            except Exception as e:
                # Safely ignore if the field already exists during a merge deployment
                if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                    deployment_errors.append(f"Failed to add field '{field_name}' to '{object_name}': {str(e)}")


    # --- PASS 2: Relationship Fields ---
    for obj in app_data.get("objects", []):
        object_name = obj["object_name"]
        for field in obj.get("fields", []):
            try:
                field_type = FieldType[field["data_type"].upper()]
            except KeyError:
                continue
                
            if field_type not in (FieldType.REFERENCE, FieldType.ROLLUP_SUMMARY):
                continue
                
            config = None
            if field_type == FieldType.REFERENCE:
                config = ReferenceConfig(
                    target_object=field["target_object"],
                    relationship_type=RelationshipType[field.get("relationship_type", "LOOKUP").upper()],
                    deletion_behavior=DeletionBehavior[field.get("deletion_behavior", "RESTRICT").upper()]
                )
            elif field_type == FieldType.ROLLUP_SUMMARY:
                config = RollupConfig(
                    child_object=field["child_object"],
                    relationship_field=field["relationship_field"],
                    operation=RollupOperation[field.get("operation", "SUM").upper()],
                    target_field=field.get("target_field")
                )
                
            field_def = FieldDefinition(field_name=field["field_name"], data_type=field_type, required=field.get("required", False), config=config)
            
            try:
                await services.schema_engine.add_field(object_name, field_def)
                admin_profile.field_permissions[f"{object_name}.{field['field_name']}"] = FieldPermission(allow_read=True, allow_update=True)
            except Exception as e:
                if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                    deployment_errors.append(f"Failed to add relationship '{field['field_name']}' to '{object_name}': {str(e)}")


    # --- PASS 3: Attach Logic and Views ---
    for obj in app_data.get("objects", []):
        object_name = obj["object_name"]
        
        # Validation Rules
        validation_rules = obj.get("validationRules") or obj.get("validation_rules", [])
        for rule in validation_rules:
            rule_def = ValidationRuleDefinition(rule_id=rule["rule_id"], error_condition_expr=rule["error_condition_expr"], error_message=rule["error_message"])
            try:
                await services.schema_engine.add_validation_rule(object_name, rule_def)
            except Exception as e:
                if "already exists" not in str(e).lower():
                    deployment_errors.append(f"Failed to add validation rule '{rule['rule_id']}' to '{object_name}': {str(e)}")
            
        # Flows (Upsert behavior is already handled by the schema engine)
        for flow in obj.get("flows", []):
            try:
                steps = FlowParser.parse_steps(flow.get("steps", []))
                variables = FlowParser.parse_variables(flow.get("variables", []))
                
                flow_def = FlowDefinition(
                    flow_id=flow["flow_id"],
                    target_object=object_name,
                    trigger_event=flow["trigger_event"],
                    execution_phase=flow.get("execution_phase", "BEFORE_SAVE"),
                    variables=variables,
                    steps=steps,
                    active=flow.get("active", True)
                )
                await services.schema_engine.upsert_flow_definition(object_name, flow_def)
            except Exception as e:
                deployment_errors.append(f"Failed to attach flow '{flow.get('flow_id')}' to '{object_name}': {str(e)}")

        # Views & Capabilities (MERGE instead of OVERWRITE)
        schema = await services.schema_engine.get_object_blueprint(object_name)
        if schema:
            # 1. Merge View Mappings
            new_views = obj.get("view_mappings", {})
            if not schema.view_mappings:
                schema.view_mappings = {}
            for view_type, view_config in new_views.items():
                schema.view_mappings[view_type] = view_config
            
            # 2. Merge Capabilities (Avoid duplicates)
            existing_caps = set(schema.capabilities or [])
            new_caps = set(obj.get("capabilities", []))
            schema.capabilities = list(existing_caps | new_caps)

            # 3. Preserve Navigation State if not explicitly provided
            if "show_in_nav" in obj:
                schema.show_in_nav = obj.get("show_in_nav")

            # 4. Handle Saved Views gracefully
            if "saved_views" in obj:
                schema.saved_views = obj.get("saved_views")

            await services.schema_engine.repository.save_schema(schema)

    await services.sec_repo.save_profile(admin_profile)

    if deployment_errors:
        raise ValueError(f"Deployment completed with errors: {deployment_errors}")

    return {"status": "Success", "deployed_objects": created_objects}

@router.post("/import")
async def import_app_from_api(app_data: Dict[str, Any], _: None = Depends(require_system_caller)):
    """Standard endpoint for importing managed packages without AI."""
    try:
        res = await deploy_manifest(app_data)
        return {"status": "Success", "message": "App deployed successfully.", "details": res}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))