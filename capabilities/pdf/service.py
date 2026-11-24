import datetime
import uuid
from typing import Dict, Any
from runtime.actionpipeline.database_transaction import DatabaseTransactionManager
from runtime.events.event_bus import EventBus, Event
from .adapter import PdfAdapter
from api.dependencies import services

class PdfCapabilityService:
    def __init__(self, db_manager: DatabaseTransactionManager, event_bus: EventBus):
        self.db_manager = db_manager
        self.event_bus = event_bus
        self.adapter = PdfAdapter()

        # 1. Register the background listener
        self.event_bus.subscribe("PDF_REQUESTED", self._handle_pdf_requested)

    async def execute_flow_action(self, step_config: Dict[str, Any], context: Any) -> Dict[str, Any]:
        template_id = step_config.get("template_id")
        parent_object = step_config.get("parent_object")
        parent_id = step_config.get("parent_record_id")
        record_data = step_config.get("record_data") 
        execution_mode = step_config.get("execution_mode", "await")

        if not template_id:
            raise ValueError("PDF template code is missing.")

        # Reusing your Jinja2 template service!
        rendered_content = await services.template_service.render_template(
            template_code=template_id,
            parent_object=parent_object,
            parent_record_id=parent_id,
            tenant_id=context.user.tenant_id,
            record_data=record_data
        )

        # ROUTE 1: Asynchronous (Fire and forget)
        if execution_mode == "async":
            self.event_bus.publish(
                topic="PDF_REQUESTED",
                object_name=parent_object,
                tenant_id=context.user.tenant_id,
                user_id=context.user.user_id,
                payload={
                    "html_body": rendered_content["body"],
                    "parent_id": parent_id
                }
            )
            return {"status": "success", "execution": "async"}

        # ROUTE 2: Synchronous (Await directly and return path)
        file_id = f"PDF-{uuid.uuid4().hex[:8].upper()}"
        file_path = await self.adapter.generate_and_save(rendered_content["body"], file_id)

        if file_path:
            log_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
            await self.db_manager.physical_save(
                tx_id=None,
                tenant_id=context.user.tenant_id,
                actor_id="SYSTEM",
                object_name="sys_DocumentLog",
                payload={
                    "Id": log_id,
                    "ParentObjectType": parent_object,
                    "ParentRecordId": parent_id,
                    "FileId": file_id,
                    "FilePath": file_path,
                    "Status": "GENERATED",
                    "GeneratedDate": datetime.datetime.now().isoformat()
                }
            )

        return {"status": "success", "file_path": file_path, "execution": "await"}

    # 2. Define the background task handler
    async def _handle_pdf_requested(self, event: Event):
        html_body = event.payload["html_body"]
        parent_id = event.payload["parent_id"]

        print(f"[PdfService] Background PDF generation started for {parent_id}")

        file_id = f"PDF-{uuid.uuid4().hex[:8].upper()}"
        file_path = await self.adapter.generate_and_save(html_body, file_id)

        if file_path:
            log_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
            await self.db_manager.physical_save(
                tx_id=None,
                tenant_id=event.tenant_id,
                actor_id="SYSTEM",
                object_name="sys_DocumentLog",
                payload={
                    "Id": log_id,
                    "ParentObjectType": event.object_name,
                    "ParentRecordId": parent_id,
                    "FileId": file_id,
                    "FilePath": file_path,
                    "Status": "GENERATED",
                    "GeneratedDate": datetime.datetime.now().isoformat()
                }
            )
            print(f"[PdfService] Background task completed and logged {log_id}")