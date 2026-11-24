import json
from typing import Optional, List, Any, Dict
from foundation.core.schema_types import (
    ObjectDefinition, FieldDefinition, FieldType, ReferenceConfig, ValidationRuleDefinition,
    FlowDefinition, FlowVariableDefinition, FlowStepDefinition, RelationshipType, DeletionBehavior,
    RollupConfig, RollupOperation
)

class PostgresSchemaMixin:
    """Mixin handling metadata schema persistence."""

    # --- SCHEMA OPERATIONS ---

    async def save_schema(self, schema: ObjectDefinition) -> None:
        # Serialize dataclass into JSON dict including validation rules AND flows
        schema_dict = {
            "object_name": schema.object_name,
            "label": schema.label,
            "fields": {
                name: {
                    "field_name": f.field_name,
                    "data_type": f.data_type.value,
                    "required": f.required,
                    "config": self._serialize_config(f.config),
                    "is_system": getattr(f, 'is_system', False)
                } for name, f in schema.fields.items()
            },
            "validation_rules": [
                {
                    "rule_id": r.rule_id,
                    "error_condition_expr": r.error_condition_expr,


                    "error_message": r.error_message
                } for r in getattr(schema, 'validation_rules', [])
            ],
            # GUARANTEE FLOWS ARE SAVED TO JSON
            "flows": [
                {
                    "flow_id": flow.flow_id,
                    "target_object": flow.target_object,
                    "trigger_event": flow.trigger_event,
                    "execution_phase": getattr(flow, 'execution_phase', 'BEFORE_SAVE'),
                    "active": getattr(flow, 'active', True),

                    # --- ADD THIS LINE ---
                    "variables": self._serialize_variables(getattr(flow, 'variables', [])),
                    # USE THE RECURSIVE HELPER HERE
                    "steps": self._serialize_steps(flow.steps)
                } for flow in getattr(schema, 'flows', [])
            ],

            "view_mappings": getattr(schema, 'view_mappings', {}),

            # --- ARCHITECTURAL FIX: Save UI metadata to Postgres ---
            "show_in_nav": getattr(schema, 'show_in_nav', True),
            "saved_views": getattr(schema, 'saved_views', []),
            "capabilities": getattr(schema, 'capabilities', []),
            "enable_rls": getattr(schema, 'enable_rls', True),

        }

        # ---> ADD THIS DEBUG PRINT <---
        query = """
            INSERT INTO erp_schemas (object_name, schema_json)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (object_name) DO UPDATE
            SET schema_json = EXCLUDED.schema_json;
        """
        async with self.pool.acquire() as conn:

            await conn.execute(query, schema.object_name, json.dumps(schema_dict))
        print(f"[Postgres DB] Saved schema for '{schema.object_name}'")

    async def get_schema(self, object_name: str) -> Optional[ObjectDefinition]:
        query = "SELECT schema_json FROM erp_schemas WHERE object_name = $1;"
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, object_name)

        if not row:
            return None

        schema_dict = json.loads(row["schema_json"])

        # ---> ADD THIS DEBUG PRINT <---

        fields = {}

        for name, f_data in schema_dict.get("fields", {}).items():
            fields[name] = FieldDefinition(
                field_name=f_data["field_name"],
                data_type=FieldType(f_data["data_type"]),
                required=f_data["required"],
                config=self._deserialize_config(f_data.get("config")),
                is_system=f_data.get("is_system", False)
            )

        validation_rules = [
            ValidationRuleDefinition(
                rule_id=r["rule_id"],
                error_condition_expr=r["error_condition_expr"],
                error_message=r["error_message"]
            ) for r in schema_dict.get("validation_rules", [])
        ]

        # GUARANTEE FLOWS ARE LOADED FROM JSON
        flows = []
        for f_data in schema_dict.get("flows", []):
            
            # USE THE RECURSIVE HELPER HERE
            steps = self._deserialize_steps(f_data.get("steps", []))

            variables = self._deserialize_variables(f_data.get("variables", []))

            flows.append(FlowDefinition(
                flow_id=f_data["flow_id"],
                target_object=f_data["target_object"],
                trigger_event=f_data["trigger_event"],
                execution_phase=f_data.get("execution_phase", "BEFORE_SAVE"),
                active=f_data.get("active", True),
                variables=variables, # <-- ADD THIS LINE
                steps=steps
            ))

        obj_def = ObjectDefinition(
            object_name=schema_dict["object_name"],
            label=schema_dict["label"],
            fields=fields
        )
        obj_def.validation_rules = validation_rules
        obj_def.flows = flows # Attach to the blueprint!

        obj_def.view_mappings = schema_dict.get("view_mappings", {})

        # --- ARCHITECTURAL FIX: Load UI metadata from Postgres ---
        obj_def.show_in_nav = schema_dict.get("show_in_nav", True)
        obj_def.saved_views = schema_dict.get("saved_views", [])
        obj_def.capabilities = schema_dict.get("capabilities", [])

        obj_def.enable_rls = schema_dict.get("enable_rls", True)

        # ---> ADD THIS DEBUG PRINT <---
        return obj_def

    async def get_all_schemas(self) -> List[ObjectDefinition]:
        """Fetches all object schemas from the erp_schemas table."""
        query = "SELECT object_name FROM erp_schemas;"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)

        schemas = []
        for row in rows:
            schema = await self.get_schema(row["object_name"])
            if schema:
                schemas.append(schema)

        return schemas

    async def list_all_schema_names(self) -> List[str]:
        """Queries the database abstraction for all registered object schema names."""
        query = "SELECT object_name FROM erp_schemas;"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [row["object_name"] for row in rows]


    async def delete_schema(self, object_name: str) -> None:
            """
            Executes a transactional wipe of the object's schema definition 
            AND all physical records, counters, and audit trails associated with it.
            """
            async with self.pool.acquire() as conn:
                # Wrap in a transaction so if data wipe fails, the schema isn't orphaned
                async with conn.transaction():
                    # 1. Wipe the blueprint definition
                    await conn.execute("DELETE FROM erp_schemas WHERE object_name = $1;", object_name)
                    
                    # 2. Wipe the physical JSONB records
                    await conn.execute("DELETE FROM erp_records WHERE object_name = $1;", object_name)
                    
                    # 3. Wipe the ID counters (so if recreated, IDs start fresh)
                    await conn.execute("DELETE FROM erp_counters WHERE object_name = $1;", object_name)
                    
                    # 4. Wipe the audit ledger history for this object
                    await conn.execute("DELETE FROM erp_audit_ledger WHERE object_name = $1;", object_name)
                    
            print(f"[Postgres DB] Successfully wiped schema and physical data footprint for '{object_name}'")

    # --- SERIALIZATION HELPERS ---
    def _serialize_config(self, config: Any) -> Any:
        if isinstance(config, ReferenceConfig):
            return {
                "__type__": "ReferenceConfig",
                "target_object": config.target_object,
                "relationship_type": config.relationship_type.value,
                "deletion_behavior": config.deletion_behavior.value,
                "filter_expression": config.filter_expression
            }
        if isinstance(config, RollupConfig):
            return {
                "__type__": "RollupConfig",
                "child_object": config.child_object,
                "relationship_field": config.relationship_field,
                "operation": config.operation.value,  # Converts Enum to string
                "target_field": config.target_field,
                "filter_expression": config.filter_expression
            }
        return config

    def _deserialize_config(self, config_dict: Any) -> Any:
        if isinstance(config_dict, dict):
            if config_dict.get("__type__") == "ReferenceConfig":
                return ReferenceConfig(
                    target_object=config_dict["target_object"],
                    relationship_type=RelationshipType(config_dict["relationship_type"]),
                    deletion_behavior=DeletionBehavior(config_dict["deletion_behavior"]),
                    filter_expression=config_dict.get("filter_expression")
                )
            if config_dict.get("__type__") == "RollupConfig":
                return RollupConfig(
                    child_object=config_dict["child_object"],
                    relationship_field=config_dict["relationship_field"],
                    operation=RollupOperation(config_dict["operation"]),  # Converts string back to Enum
                    target_field=config_dict["target_field"],
                    filter_expression=config_dict.get("filter_expression")
                )
        return config_dict

    def _serialize_steps(self, steps: List['FlowStepDefinition']) -> List[Dict[str, Any]]:
        """Recursively serializes nested flow steps into dictionaries for Postgres JSONB."""
        return [
            {
                "step_id": step.step_id,
                "function_name": step.function_name,
                "config": step.config,
                # "run_if": step.run_if,
                "true_steps": self._serialize_steps(getattr(step, 'true_steps', [])),
                "false_steps": self._serialize_steps(getattr(step, 'false_steps', [])),
                "loop_steps": self._serialize_steps(getattr(step, 'loop_steps', []))
            } for step in steps
        ]

    def _deserialize_steps(self, step_dicts: List[Dict[str, Any]]) -> List['FlowStepDefinition']:
        """Recursively hydrates dictionaries from Postgres JSONB into FlowStepDefinition dataclasses."""
        return [
            FlowStepDefinition(
                step_id=s["step_id"],
                function_name=s["function_name"],
                config=s["config"],
                # run_if=s.get("run_if"),
                true_steps=self._deserialize_steps(s.get("true_steps", [])),
                false_steps=self._deserialize_steps(s.get("false_steps", [])),
                loop_steps=self._deserialize_steps(s.get("loop_steps", []))
            ) for s in step_dicts
        ]

    def _serialize_variables(self, variables: List[Any]) -> List[Dict[str, Any]]:
        return [
            {
                "name": getattr(v, 'name', v.get('name') if isinstance(v, dict) else None),
                "data_type": getattr(v, 'data_type', v.get('data_type') if isinstance(v, dict) else None),
                "expression": getattr(v, 'expression', v.get('expression') if isinstance(v, dict) else None),
                "object_name": getattr(v, 'object_name', v.get('object_name') if isinstance(v, dict) else None),
                "is_input": getattr(v, 'is_input', v.get('is_input') if isinstance(v, dict) else False),
                "is_output": getattr(v, 'is_output', v.get('is_output') if isinstance(v, dict) else False)
            } for v in variables
        ]

    def _deserialize_variables(self, var_dicts: List[Dict[str, Any]]) -> List['FlowVariableDefinition']:
        return [
            FlowVariableDefinition(
                name=v.get("name"),
                data_type=v.get("data_type"),
                expression=v.get("expression"),
                object_name=v.get("object_name"),
                is_input=v.get("is_input", False),
                is_output=v.get("is_output", False)
            ) for v in var_dicts
        ]