from typing import List, Dict, Any
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine
from foundation.core.schema_types import FieldType

class RollupSummaryEngine:
    """Recalculates materialized rollup summaries on parent records when child records are modified."""

    def __init__(self, schema_engine: MetadataSchemaEngine, db_adapter: Any):
        self.schema_engine = schema_engine
        self.db_adapter = db_adapter

    async def execute(
        self,
        child_object_name: str,
        child_payloads: List[Dict[str, Any]],
        tenant_id: str,
        user_id: str,
        tx_id: str,
        physical_save_fn
    ) -> None:
        # # 1. Inspect the child's schema for any Reference (Lookup/Master-Detail) fields
        child_schema = await self.schema_engine.get_object_blueprint(child_object_name)
        if not child_schema:
            return

        reference_fields = {
            f_name: f_def for f_name, f_def in child_schema.fields.items()
            if f_def.data_type == FieldType.REFERENCE and f_def.config
        }
        if not reference_fields:
            return
        # # 2. Check if the targets of those references have Rollup Summary fields
        for ref_field_name, ref_field_def in reference_fields.items():
            # Support both dict and dataclass config access safely
            target_parent_obj = getattr(ref_field_def.config, 'target_object', None)
            if not target_parent_obj and isinstance(ref_field_def.config, dict):
                target_parent_obj = ref_field_def.config.get('target_object')

            if not target_parent_obj:
                continue

            parent_schema = await self.schema_engine.get_object_blueprint(target_parent_obj)
            if not parent_schema:
                continue

            rollup_fields = []
            for p_fname, p_fdef in parent_schema.fields.items():
                if p_fdef.data_type == FieldType.ROLLUP_SUMMARY and p_fdef.config:
                    child_obj_cfg = getattr(p_fdef.config, 'child_object', None) or (
                        p_fdef.config.get('child_object') if isinstance(p_fdef.config, dict) else None
                    )
                    
                    if child_obj_cfg == child_object_name:
                        rollup_fields.append((p_fname, p_fdef))

            if not rollup_fields:
                continue

            # # 3. Identify which specific parent records are affected by this chunk
            affected_parent_ids = {p.get(ref_field_name) for p in child_payloads if p.get(ref_field_name)}

            # # 4. Calculate new totals and update parents
            for parent_id in affected_parent_ids:
                parent_update_payload = {"Id": parent_id}

                for p_fname, p_fdef in rollup_fields:
                    op = getattr(p_fdef.config, 'operation', None) or (
                        p_fdef.config.get('operation') if isinstance(p_fdef.config, dict) else None
                    )
                    op_str = op.value if hasattr(op, 'value') else op

                    target_fld = getattr(p_fdef.config, 'target_field', None) or (
                        p_fdef.config.get('target_field') if isinstance(p_fdef.config, dict) else None
                    )

                    new_total = await self.db_adapter.calculate_rollup(
                        tenant_id=tenant_id,
                        child_object=child_object_name,
                        parent_field_name=ref_field_name,
                        parent_id=parent_id,
                        operation=op_str,
                        target_field=target_fld,
                        tx_id=tx_id
                    )
                    parent_update_payload[p_fname] = new_total

                # # Reuse the pipeline's physical save to update the parent inside the same transaction
                await physical_save_fn(
                    tx_id=tx_id,
                    tenant_id=tenant_id,
                    # user_id=user_id,
                    actor_id=user_id,
                    object_name=target_parent_obj,
                    payload=parent_update_payload
                )
