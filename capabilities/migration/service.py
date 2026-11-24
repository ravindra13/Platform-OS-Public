# capabilities/migration/service.py
import csv
import json
import uuid
import datetime
from io import StringIO
from runtime.context.context_models import RequestContext
from foundation.core.query_types import AbstractQuery, QueryFilter

class MigrationCapabilityService:
    def __init__(self, security_core, schema_engine, db_manager, event_bus): 
        self.security_core = security_core
        self.schema_engine = schema_engine
        self.db_manager = db_manager
        self.event_bus = event_bus

    async def create_system_job(self, job_type: str, target_object: str, context: RequestContext) -> str:
        job_id = f"JOB-{uuid.uuid4().hex[:8].upper()}"
        now_iso = datetime.datetime.now().isoformat()
        
        payload = {
            "Id": job_id,
            "JobType": job_type,
            "Status": "PENDING",
            "TargetObject": target_object,
            "Payload": {},
            "CreatedDate": now_iso,
            "CreatedById": context.user.user_id
        }
        
        tx_id = await self.db_manager.begin_transaction(context.user.tenant_id)
        try:
            await self.db_manager.physical_save(
                tx_id=tx_id,
                tenant_id=context.user.tenant_id,
                actor_id=context.user.user_id,
                object_name="sys_Job",
                payload=payload
            )
            await self.db_manager.commit(tx_id)
            return job_id
        except Exception as e:
            await self.db_manager.rollback(tx_id, str(e))
            raise e

    async def import_data(self, object_name: str, csv_text: str, mapping_json: str, context: RequestContext) -> dict:
        input_file = StringIO(csv_text)
        records = list(csv.DictReader(input_file))

        job_id = await self.create_system_job("IMPORT", object_name, context)

        self.event_bus.publish(
            topic="data_migration.import_requested",
            object_name=object_name,
            tenant_id=context.user.tenant_id,
            user_id=context.user.user_id,
            payload={
                "job_id": job_id,
                "records": records,
                "field_mapping": json.loads(mapping_json) if mapping_json else {}
            }
        )
        return {"status": "Processing", "job_id": job_id, "total_rows": len(records)}

    async def request_bulk_export(self, context: RequestContext) -> dict:
        job_id = await self.create_system_job("BULK_EXPORT", "ALL", context)

        self.event_bus.publish(
            topic="data_migration.export_requested",
            object_name="ALL",  # <-- ADD THIS LINE
            tenant_id=context.user.tenant_id,
            user_id=context.user.user_id,
            payload={"job_id": job_id}
        )
        return {"status": "Processing", "job_id": job_id}

    async def get_job_status(self, job_id: str, context: RequestContext) -> dict:
        query = AbstractQuery(
            object_name="sys_Job", 
            fields=["Id", "JobType", "Status", "Payload", "CreatedById"], 
            filters=[QueryFilter(field="Id", operator="=", value=job_id)],
            limit=1
        )
        
        # Bypassing the query pipeline, going straight to the DB adapter
        records = await self.db_manager.db_adapter.execute_abstract_query(
            query=query, 
            tenant_id=context.user.tenant_id
        )
        
        if not records:
            raise ValueError("Job not found.")
            
        # Optional: Ensure users can only see their own jobs
        if records[0]["CreatedById"] != context.user.user_id and context.mode != 'SYSTEM':
            raise PermissionError("Access denied to this job.")
            
        return records[0]


    async def get_recent_jobs(self, context: RequestContext, limit: int = 10) -> list:
        query = AbstractQuery(
            object_name="sys_Job", 
            fields=["Id", "JobType", "Status", "CreatedDate"], 
            filters=[],
            limit=limit
        )
        records = await self.db_manager.db_adapter.execute_abstract_query(
            query=query, 
            tenant_id=context.user.tenant_id
        )
        
        # ADD THIS: Map the keys to match the frontend expectations
        formatted_records = []
        for r in records:
            formatted_records.append({
                "Id": r.get("Id"),
                "job_type": r.get("JobType"),
                "status": r.get("Status"),
                "created_at": r.get("CreatedDate")
            })

        formatted_records.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
        return formatted_records

    async def export_data(self, object_name: str, context: RequestContext) -> str:
        # Define a query to get all records for the specified object
        query = AbstractQuery(
            object_name=object_name, 
            fields=[], # Empty fields list generally means "select all fields" in your setup
            filters=[],
            limit=1000 # Adding a reasonable limit for synchronous export
        )
        
        # Execute the query
        records = await self.db_manager.db_adapter.execute_abstract_query(
            query=query, 
            tenant_id=context.user.tenant_id
        )
        
        if not records:
            return ""

        # Convert records to CSV format
        output = StringIO()
        # Use the keys from the first record as column headers
        fieldnames = records[0].keys()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        
        writer.writeheader()
        writer.writerows(records)
        
        return output.getvalue()