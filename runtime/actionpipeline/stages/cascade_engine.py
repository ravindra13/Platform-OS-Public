from typing import Dict, Any
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine
from foundation.core.database_adapter import DatabaseAdapter
from foundation.core.schema_types import DeletionBehavior
# from runtime.actionpipeline.runtime_types import ExecutionContext
from runtime.context.context_models import RequestContext

class CascadeDeletionEngine:
    """Evaluates RESTRICT, CASCADE, and SET_NULL dependency rules when deleting parent records."""
    
    def __init__(self, schema_engine: MetadataSchemaEngine, db_adapter: DatabaseAdapter):
        self.schema_engine = schema_engine
        self.db_adapter = db_adapter
        
    async def process_cascades(
        self,
        object_name: str,
        parent_record_id: str,
        # context: ExecutionContext,
        context: RequestContext,
        tx_id: str,
        physical_save_fn,
        physical_delete_fn
    ) -> None:
        dependencies = self.schema_engine.evaluate_deletion_impact(object_name)
        
        for dep in dependencies:
            child_records = await self.db_adapter.query_records(
                object_name=dep.child_object,
                filters={dep.child_field: parent_record_id},
                # tenant_id=context.tenant_id
                tenant_id=context.user.tenant_id
            )
            if not child_records:
                continue

            # # 1. RESTRICT Rule
            if dep.behavior == DeletionBehavior.RESTRICT:
                raise ValueError(
                    f"Deletion Restricted: Cannot delete '{object_name}' ({parent_record_id}) because "
                    f"{len(child_records)} dependent child record(s) exist in '{dep.child_object}'."
                )

            # # 2. CASCADE Rule
            elif dep.behavior == DeletionBehavior.CASCADE:
                print(f"[Cascade Engine] CASCADE deleting {len(child_records)} child record(s) from '{dep.child_object}'")
                child_ids = [c['Id'] for c in child_records]
                for child_id in child_ids:
                    # Recursive cascade
                    await self.process_cascades(dep.child_object, child_id, context, tx_id, physical_save_fn, physical_delete_fn)
                    # await physical_delete_fn(tx_id, context.tenant_id, context.user_id, dep.child_object, child_id)
                    await physical_delete_fn(tx_id, context.user.tenant_id, context.user.user_id, dep.child_object, child_id)

            # # 3. SET_NULL Rule
            elif dep.behavior == DeletionBehavior.SET_NULL:
                print(f"[Cascade Engine] SET_NULL updating {len(child_records)} child record(s) in '{dep.child_object}'")
                for child in child_records:
                    update_payload = {"Id": child['Id'], dep.child_field: None}
                    await physical_save_fn(
                        tx_id=tx_id,
                        tenant_id=context.user.tenant_id,
                        actor_id=context.user.user_id,
                        object_name=dep.child_object,
                        payload=update_payload
                    )
