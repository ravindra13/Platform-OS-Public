from typing import Dict, Any
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine
from foundation.core.database_adapter import DatabaseAdapter
from foundation.core.schema_types import FieldType, ReferenceConfig

from foundation.expressions.expression_evaluator import ExpressionEvaluator

class ForeignKeyValidator:
    """Validates that REFERENCE fields point to existing records in the target entity."""

    def __init__(self, schema_engine: MetadataSchemaEngine, db_adapter: DatabaseAdapter):
        self.schema_engine = schema_engine
        self.db_adapter = db_adapter

    async def validate(self, object_name: str, payload: Dict[str, Any], tenant_id: str, hydrated_context: Dict[str, Any] = None, tx_id: str = None) -> None:
        blueprint = await self.schema_engine.get_object_blueprint(object_name)
        if not blueprint:
            return

        for field_name, field_def in blueprint.fields.items():
            if field_def.data_type == FieldType.REFERENCE and isinstance(field_def.config, ReferenceConfig):
                target_id = payload.get(field_name)
                if not target_id:
                    continue  # Null references allowed unless explicitly 'required'

                target_object = field_def.config.target_object
                target_record = await self.db_adapter.get_record_by_id(target_object, target_id, tenant_id, tx_id=tx_id)

                if not target_record:
                    raise ValueError(
                        f"Foreign Key Error: Field '{field_name}' references '{target_object}' record '{target_id}' "
                        f"which does not exist for Tenant '{tenant_id}'."
                    )

                # # 2. Add the Filtered Lookup Enforcement Block
                if field_def.config.filter_expression:

                    # # USE HYDRATED CONTEXT IF PROVIDED, FALLBACK TO NESTED WRAPPER
                    eval_context = hydrated_context if hydrated_context else {target_object: target_record}

                    is_valid = ExpressionEvaluator.evaluate(field_def.config.filter_expression, eval_context)

                    if not is_valid:
                        raise ValueError(
                            f"Lookup Filter Error: The selected '{target_object}' record '{target_id}' "
                            f"does not satisfy the filter criteria for '{field_name}'. "
                            f"(Rule: {field_def.config.filter_expression})"
                        )

                print(f"[FK Validator] Validated reference {object_name}.{field_name} -> {target_object} ({target_id})")
