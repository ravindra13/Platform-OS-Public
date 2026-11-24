from typing import Dict, Any
from jinja2 import Template
from runtime.actionpipeline.database_transaction import DatabaseTransactionManager
from foundation.core.query_types import AbstractQuery, QueryFilter

class TemplateCapabilityService:
    def __init__(self, db_manager: DatabaseTransactionManager):
        self.db_manager = db_manager

    async def render_template(
        self, 
        template_code: str, 
        tenant_id: str,
        parent_object: str = None, 
        parent_record_id: str = None, 
        record_data: dict = None # <-- NEW PARAMETER
    ) -> Dict[str, str]:
        
        # 1. Fetch Template
        template_query = AbstractQuery(
            object_name="sys_MessageTemplate",
            fields=["Subject", "Body", "Channel"],
            filters=[QueryFilter(field="TemplateCode", operator="=", value=template_code)],
            limit=1
        )
        templates = await self.db_manager.db_adapter.execute_abstract_query(
            query=template_query, tenant_id=tenant_id
        )
        if not templates:
            raise ValueError(f"Message template '{template_code}' not found.")
        
        template_data = templates[0]

        # 2. Fetch Record Data for merging (Optimized)
        if record_data:
            # Use memory passed from the Flow Engine
            record_context = record_data
        else:
            # Fallback to database query only if memory isn't provided
            record_context = {}
            if parent_object and parent_record_id:
                record_query = AbstractQuery(
                    object_name=parent_object,
                    fields=[], 
                    filters=[QueryFilter(field="Id", operator="=", value=parent_record_id)],
                    limit=1
                )
                records = await self.db_manager.db_adapter.execute_abstract_query(
                    query=record_query, tenant_id=tenant_id
                )
                if records:
                    record_context = records[0]

        merge_context = {"Record": record_context}

        # 3. Render strings safely using Jinja2
        rendered_subject = ""
        if template_data.get("Subject"):
            jinja_subject = Template(template_data["Subject"])
            rendered_subject = jinja_subject.render(merge_context)

        rendered_body = ""
        if template_data.get("Body"):
            jinja_body = Template(template_data["Body"])
            rendered_body = jinja_body.render(merge_context)

        return {
            "channel": template_data.get("Channel"),
            "subject": rendered_subject,
            "body": rendered_body
        }