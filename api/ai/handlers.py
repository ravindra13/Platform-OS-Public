# api/ai/handlers.py
from typing import Dict, Any
from foundation.core.query_types import AbstractQuery, QueryFilter
from foundation.core.security_types import ObjectPermission
from foundation.flow.flow_parser import FlowParser

from foundation.core.schema_types import (
    FieldDefinition, 
    FieldType,
    ValidationRuleDefinition,
    FlowDefinition,
    PicklistConfig,        # <-- Add this
    ReferenceConfig,       # <-- Add this
    RelationshipType,      # <-- Add this
    DeletionBehavior,       # <-- Add this
    FormulaConfig,
    RollupConfig,
    RollupOperation
)

# ... existing code ...

class AIToolHandlers:

    @staticmethod
    async def list_metadata_objects(req_context: Any, meta_repo: Any, security_core: Any) -> Dict[str, Any]:
        all_schemas = await meta_repo.get_all_schemas() if hasattr(meta_repo, 'get_all_schemas') else []
        accessible = []
        for schema in all_schemas:
            obj_name = schema.object_name
            has_access = await security_core.has_object_access(req_context.user.user_id, obj_name, 'READ')
            if req_context.mode == 'SYSTEM' or has_access:
                accessible.append({"object_name": obj_name, "label": schema.label})
        return {"objects": accessible}

    @staticmethod
    async def get_object_schema(object_name: str, req_context: Any, schema_engine: Any, security_core: Any) -> Dict[str, Any]:
        blueprint = await schema_engine.get_object_blueprint(object_name)
        if not blueprint:
            return {"error": f"Object '{object_name}' not found."}

        fields_info = []
        for field_name, field_def in blueprint.fields.items():
            can_read = await security_core.has_field_access(req_context.user.user_id, object_name, field_name, 'READ')
            if can_read or req_context.mode == 'SYSTEM':
                fields_info.append({
                    "field_name": field_name,
                    "data_type": field_def.data_type.value if hasattr(field_def.data_type, 'value') else str(field_def.data_type),
                    "required": field_def.required
                })

        # --- EXTRACT RULES, FLOWS, AND CAPABILITIES ---
        rules_info = [
            {
                "rule_id": r.rule_id, 
                "error_condition_expr": r.error_condition_expr, 
                "error_message": r.error_message
            } 
            for r in getattr(blueprint, 'validation_rules', [])
        ]

        flows_summary = [
            {
                "flow_id": getattr(f, 'flow_id', None) or f.get('flow_id'),
                "trigger_event": getattr(f, 'trigger_event', None) or f.get('trigger_event'),
                "execution_phase": getattr(f, 'execution_phase', 'BEFORE_SAVE') or f.get('execution_phase', 'BEFORE_SAVE'),
                "active": getattr(f, 'active', True) if not isinstance(f, dict) else f.get('active', True),
                "step_count": len(getattr(f, 'steps', []) or f.get('steps', []))
            }
            for f in getattr(blueprint, 'flows', [])
        ]
        
        # Architecturally Superior: Expose capabilities and views so the AI doesn't hallucinate state
        capabilities_info = getattr(blueprint, 'capabilities', [])
        views_info = getattr(blueprint, 'view_mappings', {})

        return {
            "object_name": object_name, 
            "label": blueprint.label, 
            "fields": fields_info,
            "validation_rules": rules_info, 
            "flows": flows_summary,
            "capabilities": capabilities_info,
            "view_mappings": views_info
        }

    @staticmethod
    async def execute_data_query(args: Dict[str, Any], req_context: Any, query_pipeline: Any) -> Dict[str, Any]:
        filters = [QueryFilter(field=f["field"], operator=f["operator"], value=f["value"]) for f in args.get("filters", [])]
        query = AbstractQuery(object_name=args["object_name"], fields=args["fields"], filters=filters)
        query_result = await query_pipeline.execute_query(query, req_context)
        return {"records": query_result.records}

    @staticmethod
    async def save_data_records(args: Dict[str, Any], req_context: Any, action_pipeline: Any) -> Dict[str, Any]:
        results = await action_pipeline.execute_save(
            args["object_name"],
            args["records"],
            req_context,
            allow_partial_success=True
        )
        
        formatted_results = []
        for r in results:
            formatted_results.append({
                "success": r.success if hasattr(r, 'success') else True,
                "record_id": r.record_id if hasattr(r, 'record_id') else None,
                "errors": r.errors if hasattr(r, 'errors') else []
            })
            
        return {"transaction_id": req_context.transaction_id, "results": formatted_results}

    # --- GRANULAR SCHEMA HANDLERS ---

    @staticmethod
    async def create_object(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        try:
            await schema_engine.create_object(
                object_name=args["object_name"], 
                label=args["label"]
            )
            return {"status": "Success", "message": f"Object '{args['object_name']}' created successfully."}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def add_field(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        try:
            field_enum = FieldType[args["data_type"].upper()]
            
            # --- ARCHITECTURAL ADAPTER LOGIC ---
            config = None
            if field_enum == FieldType.PICKLIST:
                config = PicklistConfig(allowed_values=args.get("allowed_values", []))
            elif field_enum == FieldType.REFERENCE:
                config = ReferenceConfig(
                    target_object=args.get("target_object"),
                    relationship_type=RelationshipType.LOOKUP,
                    deletion_behavior=DeletionBehavior.RESTRICT
                )

            elif field_enum == FieldType.FORMULA:
                config = FormulaConfig(
                    expression=args.get("expression", ""),
                    return_type=args.get("return_type", "STRING")
                )
            elif field_enum == FieldType.ROLLUP_SUMMARY:
                config = RollupConfig(
                    child_object=args.get("child_object"),
                    relationship_field=args.get("relationship_field"),
                    operation=RollupOperation[args.get("operation", "SUM").upper()],
                    target_field=args.get("target_field")
                )
            
            field_def = FieldDefinition(
                field_name=args["field_name"],
                data_type=field_enum,
                required=args.get("required", False),
                config=config
            )
            
            await schema_engine.add_field(args["object_name"], field_def)
            return {"status": "Success", "message": f"Field '{args['field_name']}' appended to '{args['object_name']}'."}
        except KeyError:
            return {"error": f"Invalid data_type provided: {args['data_type']}"}
        except Exception as e:
            return {"error": str(e)}    

    @staticmethod
    async def add_validation_rule(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        try:
            rule_def = ValidationRuleDefinition(
                rule_id=args["rule_id"],
                error_condition_expr=args["error_condition_expr"],
                error_message=args["error_message"]
            )
            
            await schema_engine.add_validation_rule(args["object_name"], rule_def)
            return {"status": "Success", "message": f"Validation rule '{args['rule_id']}' added to '{args['object_name']}'."}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def update_object_permissions(args: Dict[str, Any], sec_repo: Any) -> Dict[str, Any]:
        try:
            profile_id = args["profile_id"]
            object_name = args["object_name"]
            
            profile = await sec_repo.get_profile(profile_id)
            if not profile:
                return {"error": f"Profile '{profile_id}' not found."}

            profile.object_permissions[object_name] = ObjectPermission(
                allow_create=args.get("allow_create", False),
                allow_read=args.get("allow_read", False),
                allow_update=args.get("allow_update", False),
                allow_delete=args.get("allow_delete", False)
            )

            await sec_repo.save_profile(profile)
            return {"status": "Success", "message": f"Updated permissions for {object_name} on Profile {profile_id}"}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def update_field_security(args: Dict[str, Any], security_core: Any) -> Dict[str, Any]:
        try:
            await security_core.update_field_permission(
                profile_id=args["profile_id"],
                object_name=args["object_name"],
                field_name=args["field_name"],
                allow_read=args["allow_read"],
                allow_update=args["allow_update"]
            )
            
            field_key = f"{args['object_name']}.{args['field_name']}"
            return {"status": "Success", "message": f"Updated FLS for {field_key} on profile {args['profile_id']}."}
        except ValueError as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def update_validation_rule(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        try:
            await schema_engine.update_validation_rule(
                object_name=args["object_name"],
                rule_id=args["rule_id"],
                error_condition_expr=args.get("error_condition_expr"),
                error_message=args.get("error_message")
            )
            return {"status": "Success", "message": f"Validation rule '{args['rule_id']}' updated."}
        except Exception as e:
            return {"error": str(e)}


    # handlers.py

    @staticmethod
    async def update_system_layout(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        try:
            await schema_engine.update_system_layout(
                object_name=args["object_name"],
                layout_name=args["layout_name"],
                layout_config=args["config"]
            )
            return {"status": "Success", "message": f"System layout '{args['layout_name']}' updated."}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def create_custom_view(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        try:
            await schema_engine.upsert_custom_view(
                object_name=args["object_name"],
                view_id=args["view_id"],
                tab_label=args.get("tab_label"),
                view_type=args.get("view_type"),
                visible_to_roles=args.get("visible_to_roles", []),
                view_config=args["config"]
            )
            return {"status": "Success", "message": f"Custom view '{args['view_id']}' updated."}
        except Exception as e:
            return {"error": str(e)}
    # --- NEW CODE: STANDALONE CAPABILITIES UPDATER ---
    @staticmethod
    async def update_object_capabilities(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        """Calls Schema Engine to update the array of active capabilities on an object."""

        try:
            await schema_engine.update_object_capabilities(
                object_name=args["object_name"],
                capabilities=args["capabilities"]
            )
            return {"status": "Success", "message": f"Capabilities for {args['object_name']} updated to: {', '.join(args['capabilities'])}"}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def create_flow(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        try:
            steps = FlowParser.parse_steps(args.get("steps", []))
            variables = FlowParser.parse_variables(args.get("variables", []))
            
            flow_def = FlowDefinition(
                flow_id=args["flow_id"],
                target_object=args["target_object"],
                trigger_event=args["trigger_event"],
                execution_phase=args.get("execution_phase", "BEFORE_SAVE"),
                variables=variables,
                steps=steps,
                active=True
            )
            
            await schema_engine.upsert_flow_definition(args["target_object"], flow_def)
            return {"status": "Success", "message": f"Flow '{args['flow_id']}' successfully deployed."}
        except Exception as e:
            return {"error": str(e)}

    # --- DELETION & OFFBOARDING HANDLERS ---

    @staticmethod
    async def delete_records(args: Dict[str, Any], req_context: Any, action_pipeline: Any) -> Dict[str, Any]:
        """Deletes business records via the Action Pipeline."""
        try:
            results = await action_pipeline.execute_delete(
                object_name=args["object_name"],
                record_ids=args["record_ids"],
                context=req_context
            )
            return {"status": "Success", "transaction_id": req_context.transaction_id, "results": results}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def delete_object(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        """Phase-gated deletion of an entire metadata object."""
        try:
            await schema_engine.delete_object(args["object_name"])
            return {"status": "Success", "message": f"Object '{args['object_name']}' and all its data deleted."}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def delete_field(args: Dict[str, Any], schema_engine: Any) -> Dict[str, Any]:
        """Phase-gated deletion of a specific field."""
        try:
            await schema_engine.delete_field(args["object_name"], args["field_name"])
            return {"status": "Success", "message": f"Field '{args['field_name']}' successfully removed from '{args['object_name']}'."}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def revoke_record_share(args: Dict[str, Any], req_context: Any, security_core: Any) -> Dict[str, Any]:
        """Revokes explicit sharing access from a user."""
        try:
            await security_core.revoke_access(
                record_id=args["record_id"],
                shared_with_id=args["target_user_id"],
                actor_id=req_context.user.user_id
            )
            return {"status": "Success", "message": f"Access to {args['record_id']} revoked for {args['target_user_id']}."}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def share_record(args: Dict[str, Any], req_context: Any, security_core: Any) -> Dict[str, Any]:
        """Grants explicit sharing access to a user via the AI."""
        try:
            await security_core.grant_access(
                object_name=args["object_name"],
                record_id=args["record_id"],
                shared_with_id=args["target_user_id"],
                access_level=args["access_level"],
                actor_id=req_context.user.user_id
            )
            return {
                "status": "Success", 
                "message": f"Record {args['record_id']} successfully shared with {args['target_user_id']} ({args['access_level']} access)."
            }
        except PermissionError as e:
            return {"error": f"Permission Denied: {str(e)}"}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def delete_user(args: Dict[str, Any], req_context: Any, sec_repo: Any, action_pipeline: Any) -> Dict[str, Any]:
        """Dual-layer offboarding: removes the user from the identity and metadata layers."""
        try:
            user_id = args["user_id"]
            # 1. Wipe Security Layer
            await sec_repo.delete_user(user_id)
            # 2. Wipe Metadata Layer
            await action_pipeline.execute_delete("User", [user_id], req_context)
            return {"status": "Success", "message": f"User '{user_id}' has been fully offboarded from all layers."}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    async def delete_profile(args: Dict[str, Any], req_context: Any, sec_repo: Any, action_pipeline: Any) -> Dict[str, Any]:
        """Dual-layer removal: removes the profile from the identity and metadata layers."""
        try:
            profile_id = args["profile_id"]
            # 1. Wipe Security Layer
            await sec_repo.delete_profile(profile_id)
            # 2. Wipe Metadata Layer
            await action_pipeline.execute_delete("Profile", [profile_id], req_context)
            return {"status": "Success", "message": f"Profile '{profile_id}' has been completely removed."}
        except Exception as e:
            return {"error": str(e)}

    # @staticmethod
    # async def deploy_module_blueprint(args: Dict[str, Any], schema_engine: Any, sec_repo: Any) -> Dict[str, Any]:
    #     """Executes a full module deployment in a single backend process."""
    #     try:
    #         object_name = args["object_name"]
            
    #         # 1. Create the base object
    #         await schema_engine.create_object(object_name=object_name, label=args["label"])
            
    #         # 2. Iterate and append fields
    #         for field_config in args.get("fields", []):
    #             field_config["object_name"] = object_name
    #             # Re-use the existing add_field logic
    #             await AIToolHandlers.add_field(field_config, schema_engine)
                
    #         # 3. Iterate and apply permissions
    #         for perm_config in args.get("permissions", []):
    #             perm_config["object_name"] = object_name
    #             # Re-use the existing permissions logic
    #             await AIToolHandlers.update_object_permissions(perm_config, sec_repo)
                
    #         return {
    #             "status": "Success", 
    #             "message": f"Module '{object_name}' deployed successfully in a single batch operation."
    #         }
    #     except Exception as e:
    #         return {"error": f"Batch deployment failed: {str(e)}"}


    @staticmethod
    async def deploy_module_blueprint(args: Dict[str, Any], schema_engine: Any, sec_repo: Any) -> Dict[str, Any]:
        """Builds an object in one batch, then reads back what actually exists."""
        try:
            object_name = args["object_name"]
            failures = []

            # 1. Create the base object
            await schema_engine.create_object(object_name=object_name, label=args["label"])

            # 2. Add fields. Collect failures instead of ignoring them.
            for field_config in args.get("fields", []):
                field_config["object_name"] = object_name
                result = await AIToolHandlers.add_field(field_config, schema_engine)
                if "error" in result:
                    failures.append(f"Field '{field_config.get('field_name')}': {result['error']}")

            # 3. Apply permissions, same treatment
            for perm_config in args.get("permissions", []):
                perm_config["object_name"] = object_name
                result = await AIToolHandlers.update_object_permissions(perm_config, sec_repo)
                if "error" in result:
                    failures.append(f"Permissions for '{perm_config.get('profile_id')}': {result['error']}")

            # 4. READ BACK: report what really exists, not what was requested
            blueprint = await schema_engine.get_object_blueprint(object_name)
            actual_fields = {}
            if blueprint:
                actual_fields = {
                    name: (fd.data_type.value if hasattr(fd.data_type, "value") else str(fd.data_type))
                    for name, fd in blueprint.fields.items()
                    if not getattr(fd, "is_system", False)
                }

            requested = [f.get("field_name") for f in args.get("fields", [])]
            missing = [name for name in requested if name not in actual_fields]

            return {
                "status": "Success" if not failures and not missing else "PartialSuccess",
                "object_name": object_name,
                "actual_fields": actual_fields,
                "failed_items": failures,
                "requested_but_missing_fields": missing,
                "instruction_to_assistant": (
                    "Tell the user only what appears in actual_fields. If failed_items or "
                    "requested_but_missing_fields is not empty, say plainly what was not created."
                )
            }
        except Exception as e:
            return {"error": f"Batch deployment failed: {str(e)}"}