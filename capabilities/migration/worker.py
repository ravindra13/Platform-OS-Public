import os
import csv
import uuid
import zipfile
from io import StringIO
from runtime.events.event_bus import Event
from runtime.context.context_models import RequestContext, UserContext
from foundation.core.query_types import AbstractQuery

class MigrationWorker:
    def __init__(self, db_manager, schema_engine, action_pipeline=None, query_pipeline=None):
        self.db_manager = db_manager
        self.schema_engine = schema_engine
        self.action_pipeline = action_pipeline
        self.query_pipeline = query_pipeline

    def _build_system_context(self, tenant_id: str, user_id: str) -> RequestContext:
        """Creates a SYSTEM-level RequestContext for background pipeline operations."""
        user_ctx = UserContext(
            tenant_id=tenant_id,
            user_id=user_id,
            profile_id="SYSTEM",
            cached_object_perms={},
            cached_field_perms={}
        )
        return RequestContext(
            user=user_ctx,
            mode="SYSTEM",
            transaction_id=f"BG-{uuid.uuid4().hex[:8].upper()}"
        )

    async def update_job_status(self, tenant_id: str, job_id: str, status: str, payload_data: dict = None):
        """Bypasses the action pipeline to directly update the sys_Job record."""
        tx_id = await self.db_manager.begin_transaction(tenant_id)
        try:
            update_payload = {"Id": job_id, "Status": status}
            if payload_data is not None:
                update_payload["Payload"] = payload_data

            await self.db_manager.physical_save(
                tx_id=tx_id,
                tenant_id=tenant_id,
                actor_id="SYSTEM",
                object_name="sys_Job",
                payload=update_payload
            )
            await self.db_manager.commit(tx_id)
        except Exception as e:
            await self.db_manager.rollback(tx_id, str(e))
            print(f"[Migration Worker] Failed to update job {job_id} status: {e}")

    async def handle_import_job(self, event: Event) -> None:
        if event.topic != "data_migration.import_requested":
            return

        job_id = event.payload.get("job_id")
        records = event.payload.get("records", [])
        field_mapping = event.payload.get("field_mapping", {})
        tenant_id = event.tenant_id
        user_id = event.user_id
        object_name = event.object_name

        await self.update_job_status(tenant_id, job_id, "PROCESSING")

        try:
            system_context = self._build_system_context(tenant_id, user_id)
            mapped_records = []

            for row in records:
                if field_mapping:
                    mapped_row = {
                        field_mapping.get(k, k): v
                        for k, v in row.items()
                        if v != "" and v is not None
                    }
                else:
                    mapped_row = {k: v for k, v in row.items() if v != "" and v is not None}
                mapped_records.append(mapped_row)

            # Execute batch save via ActionPipeline (preserves triggers, validation, and is_external_id upsert)
            await self.action_pipeline.execute_save(
                object_name,
                mapped_records,
                system_context
            )

            await self.update_job_status(
                tenant_id,
                job_id,
                "COMPLETED",
                {"total_rows": len(records), "processed_rows": len(mapped_records)}
            )

        except Exception as e:
            await self.update_job_status(tenant_id, job_id, "FAILED", {"error": str(e)})

    async def handle_export_job(self, event: Event) -> None:
        if event.topic != "data_migration.export_requested":
            return

        job_id = event.payload.get("job_id")
        tenant_id = event.tenant_id
        user_id = event.user_id

        await self.update_job_status(tenant_id, job_id, "PROCESSING")

        try:
            system_context = self._build_system_context(tenant_id, user_id)
            all_objects = await self.schema_engine.repository.list_schemas()

            export_dir = "./storage/exports"
            os.makedirs(export_dir, exist_ok=True)
            zip_filename = os.path.join(export_dir, f"export_{tenant_id}_{job_id}.zip")

            with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for obj_name in all_objects:
                    blueprint = await self.schema_engine.get_object_blueprint(obj_name)
                    if not blueprint:
                        continue

                    query = AbstractQuery(
                        object_name=obj_name,
                        fields=list(blueprint.fields.keys()),
                        filters=[]
                    )
                    query_result = await self.query_pipeline.execute_query(query, system_context)

                    if not query_result.records:
                        continue

                    output = StringIO()
                    writer = csv.DictWriter(
                        output,
                        fieldnames=list(blueprint.fields.keys()),
                        extrasaction='ignore'
                    )
                    writer.writeheader()
                    for record in query_result.records:
                        writer.writerow(record)

                    zipf.writestr(f"{obj_name}.csv", output.getvalue())

            await self.update_job_status(tenant_id, job_id, "COMPLETED", {"file_path": zip_filename})

        except Exception as e:
            await self.update_job_status(tenant_id, job_id, "FAILED", {"error": str(e)}) 