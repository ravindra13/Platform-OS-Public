import uuid
import datetime
from typing import Dict, Any
from foundation.security.security_policy_core import SecurityPolicyCore
from runtime.actionpipeline.database_transaction import DatabaseTransactionManager
from runtime.events.event_bus import EventBus
from runtime.context.context_models import RequestContext
from foundation.core.query_types import AbstractQuery, QueryFilter

class InboxCapabilityService:
    def __init__(
        self,
        security_core: SecurityPolicyCore,
        db_manager: DatabaseTransactionManager,
        event_bus: EventBus
    ):
        self.security_core = security_core
        self.db_manager = db_manager
        self.event_bus = event_bus

    async def add_message(
        self,
        parent_object: str,
        parent_record_id: str,
        message_body: str,
        context: RequestContext
    ) -> Dict[str, Any]:

        # 1. SECURITY INHERITANCE: Check parent record access[cite: 18]
        if context.mode == 'USER':
            has_access = await self.security_core.has_record_access(
                context.user.user_id, parent_object, parent_record_id, 'READ'
            )
        
            if not has_access:
                raise PermissionError(f"User lacks access to parent record {parent_record_id}")

        tx_id = await self.db_manager.begin_transaction(context.user.tenant_id)

        try:
            # Step A: Resolve or Create the Thread
            thread_id = await self._get_or_create_thread(
                parent_object, parent_record_id, context, tx_id
            )

            # Step B: Construct System Payload with Audit Fields
            now_iso = datetime.datetime.now().isoformat()
            message_id = f"msg-{uuid.uuid4().hex[:8].upper()}"
            message_payload = {
                "Id": message_id,
                "ThreadId": thread_id,
                "SenderId": context.user.user_id,
                "Body": message_body,
                "Timestamp": now_iso,
                # Manual System Audit Fields since we bypass the schema engine
                "CreatedDate": now_iso,
                "CreatedById": context.user.user_id
            }

            # Step C: Physical Save via DB Manager
            saved_message = await self.db_manager.physical_save(
                tx_id=tx_id,
                tenant_id=context.user.tenant_id,
                actor_id=context.user.user_id,
                object_name="sys_Message",
                payload=message_payload
            )

            await self.db_manager.commit(tx_id)

            # Step D: Broadcast to Event Bus for workflow listeners
            self.event_bus.publish(
                topic="ON_INBOX_MESSAGE",
                object_name=parent_object,
                tenant_id=context.user.tenant_id,
                user_id=context.user.user_id,
                payload={"parent_id": parent_record_id, "message": saved_message}
            )

            return saved_message

        except Exception as e:
            await self.db_manager.rollback(tx_id, str(e))
            raise e

    async def _get_or_create_thread(
        self,
        parent_object: str,
        parent_record_id: str,
        context: RequestContext,
        tx_id: str
    ) -> str:
        # Query the database adapter directly to check if a thread exists
        query = AbstractQuery(
            object_name="sys_Thread",
            fields=["Id"],
            filters=[QueryFilter(field="ParentRecordId", operator="=", value=parent_record_id)],
            limit=1
        )

        existing_threads = await self.db_manager.db_adapter.execute_abstract_query(
            query=query,
            tenant_id=context.user.tenant_id,
            tx_id=tx_id
        )

        if existing_threads:
            return existing_threads[0]["Id"]

        # If no thread exists, create one
        thread_id = f"THR-{uuid.uuid4().hex[:8].upper()}"
        now_iso = datetime.datetime.now().isoformat()

        thread_payload = {
            "Id": thread_id,
            "ParentObjectType": parent_object,
            "ParentRecordId": parent_record_id,
            "CreatedDate": now_iso,
            "CreatedById": context.user.user_id
        }

        await self.db_manager.physical_save(
            tx_id=tx_id,
            tenant_id=context.user.tenant_id,
            actor_id=context.user.user_id,
            object_name="sys_Thread",
            payload=thread_payload
        )
        return thread_id

    async def get_thread_messages(
        self,
        parent_object: str,
        parent_record_id: str,
        context: RequestContext
    ) -> list:
        # # 1. SECURITY INHERITANCE: Check parent record access
        if context.mode == 'USER':
            has_access = await self.security_core.has_record_access(
                context.user.user_id, parent_object, parent_record_id, 'READ'
            )
            if not has_access:
                raise PermissionError(f"User lacks READ access to parent record {parent_record_id}")

        # # 2. Find the Thread ID for this record
        thread_query = AbstractQuery(
            object_name="sys_Thread",
            fields=["Id"],
            filters=[QueryFilter(field="ParentRecordId", operator="=", value=parent_record_id)],
            limit=1
        )

        # # We only need read access, so no transaction ID is required
        threads = await self.db_manager.db_adapter.execute_abstract_query(
            query=thread_query,
            tenant_id=context.user.tenant_id
        )

        if not threads:
            return []  # No thread has been created for this record yet
        thread_id = threads[0]["Id"]

        # # 3. Fetch all messages for this Thread
        message_query = AbstractQuery(
            object_name="sys_Message",
            fields=[],  # Empty list returns the full payload
            filters=[QueryFilter(field="ThreadId", operator="=", value=thread_id)],
            limit=None
        )

        messages = await self.db_manager.db_adapter.execute_abstract_query(
            query=message_query,
            tenant_id=context.user.tenant_id
        )

        # # 4. Sort chronologically by Timestamp
        # # (Doing this in Python ensures it works regardless of underlying DB dialect)
        sorted_messages = sorted(messages, key=lambda m: m.get("Timestamp", ""))

        return sorted_messages


