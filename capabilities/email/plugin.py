from capabilities.base import CapabilityPlugin
from capabilities.email.service import EmailCapabilityService
from capabilities.email.router import router
from foundation.flow.function_registry import FunctionRegistry, resolve_operand

class EmailPlugin(CapabilityPlugin):
    @property
    def name(self) -> str:
        return "email"

    async def on_startup(self, services) -> None:
        services.email_service = EmailCapabilityService(
            db_manager=services.db_manager,
            event_bus=services.event_bus
        )
        
        @FunctionRegistry.register("SEND_EMAIL", ui_schema={
            "label": "Send Email",
            "category": "Communication",
            "config_fields": [
                {"name": "template_code", "type": "operand", "label": "Template Code", "required": True},
                {"name": "recipient_email", "type": "operand", "label": "Recipient Email", "required": True},
                {"name": "target_object", "type": "string", "label": "Target Object", "required": False},
                {"name": "record_id", "type": "operand", "label": "Record ID", "required": False},
                # <-- NEW FIELD DECLARED HERE -->
                {"name": "attachment_path", "type": "operand", "label": "Attachment Path", "required": False} 
            ]
        })
        async def send_email_primitive(config, context, db_adapter, resolver):
            
            resolved_template = resolve_operand(config.get("template_code", {}), context, resolver)
            recipient = resolve_operand(config.get("recipient_email", {}), context, resolver)
            
            # <-- RESOLVE NEW FIELD -->
            attachment_path = resolve_operand(config.get("attachment_path", {}), context, resolver) 
            
            record_id_mapping = config.get("record_id", {"value": "Record.Id", "rightOperandType": "REFERENCE"})
            record_id = resolve_operand(record_id_mapping, context, resolver)
            
            req_context = context.get("__request_context__")
            
            await services.email_service.execute_flow_action(
                step_config={
                    "template_id": resolved_template,
                    "recipient_email": recipient,  
                    "parent_object": config.get("target_object"),
                    "parent_record_id": record_id,
                    "record_data": context.get("Record"),
                    # <-- PASS TO SERVICE -->
                    "attachment_path": attachment_path 
                },
                context=req_context
            )
            return context

        print("[Email Plugin] Service initialized and self-registered.")

    def get_routers(self) -> list:
        return [router]