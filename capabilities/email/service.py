import datetime
import uuid
import os
from typing import Dict, Any
from runtime.actionpipeline.database_transaction import DatabaseTransactionManager
from runtime.events.event_bus import EventBus, Event
from .adapter import EmailAdapter
from api.dependencies import services 

from dotenv import load_dotenv

load_dotenv() # Add this line to read the .env file

SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASS = os.environ.get("SMTP_PASS")


class EmailCapabilityService:
    def __init__(self, db_manager: DatabaseTransactionManager, event_bus: EventBus):
        self.db_manager = db_manager
        self.event_bus = event_bus
        self.adapter = EmailAdapter(
            smtp_user=SMTP_USER, 
            smtp_password=SMTP_PASS
        )
        self.event_bus.subscribe("EMAIL_REQUESTED", self._handle_email_requested)

    async def execute_flow_action(self, step_config: Dict[str, Any], context: Any) -> Dict[str, Any]:
        template_id = step_config.get("template_id")
        recipient = step_config.get("recipient_email")
        parent_object = step_config.get("parent_object")
        parent_id = step_config.get("parent_record_id")
        record_data = step_config.get("record_data") 
        # <-- GRAB ATTACHMENT PATH -->
        attachment_path = step_config.get("attachment_path") 

        if not template_id:
            raise ValueError("Email template code/ID is missing.")

        rendered_content = await services.template_service.render_template(
            template_code=template_id,
            parent_object=parent_object,
            parent_record_id=parent_id,
            tenant_id=context.user.tenant_id,
            record_data=record_data
        )

        self.event_bus.publish(
            topic="EMAIL_REQUESTED",
            object_name=parent_object,
            tenant_id=context.user.tenant_id,
            user_id=context.user.user_id,
            payload={
                "recipient": recipient,
                "subject": rendered_content["subject"],
                "body": rendered_content["body"],
                "parent_id": parent_id,
                # <-- ADD TO EVENT PAYLOAD -->
                "attachment_path": attachment_path 
            }
        )
        return {"status": "success", "sent": "pending_background"}

    async def _handle_email_requested(self, event: Event):
        recipient = event.payload["recipient"]
        subject = event.payload["subject"]
        body = event.payload["body"]
        parent_id = event.payload["parent_id"]
        # <-- EXTRACT FROM EVENT PAYLOAD -->
        attachment_path = event.payload.get("attachment_path") 

        print(f"[EmailService] Background task started for {recipient}")

        # <-- PASS ATTACHMENT TO ADAPTER -->
        success = await self.adapter.send_transactional_email(
            recipient, subject, body, attachment_path
        )

        if success:
            log_id = f"EML-{uuid.uuid4().hex[:8].upper()}"
            await self.db_manager.physical_save(
                tx_id=None,
                tenant_id=event.tenant_id,
                actor_id="SYSTEM",
                object_name="sys_EmailLog",
                payload={
                    "Id": log_id,
                    "ParentObjectType": event.object_name,
                    "ParentRecordId": parent_id,
                    "Recipient": recipient,
                    "Status": "SENT",
                    "SentDate": datetime.datetime.now().isoformat()
                }
            )
            print(f"[EmailService] Background task completed and logged {log_id}")