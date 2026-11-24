from capabilities.base import CapabilityPlugin
from capabilities.pdf.service import PdfCapabilityService
from capabilities.pdf.router import router
from foundation.flow.function_registry import FunctionRegistry, resolve_operand

class PdfPlugin(CapabilityPlugin):
    @property
    def name(self) -> str:
        return "pdf"

    async def on_startup(self, services) -> None:
        services.pdf_service = PdfCapabilityService(
            db_manager=services.db_manager,
            event_bus=services.event_bus
        )
        
        @FunctionRegistry.register("GENERATE_PDF", ui_schema={
            "label": "Generate PDF",
            "category": "Document",
            "config_fields": [
                {"name": "template_code", "type": "operand", "label": "Template Code", "required": True},
                {"name": "target_object", "type": "string", "label": "Target Object", "required": False},
                {"name": "record_id", "type": "operand", "label": "Record ID", "required": False},
                {"name": "output_variable", "type": "string", "label": "Output Variable", "required": False},
                {"name": "execution_mode", "type": "string", "label": "Execution Mode", "required": False}
            ]
        })
        async def generate_pdf_primitive(config, context, db_adapter, resolver):
            
            resolved_template = resolve_operand(config.get("template_code", {}), context, resolver)
            
            record_id_mapping = config.get("record_id", {"value": "Record.Id", "rightOperandType": "REFERENCE"})
            record_id = resolve_operand(record_id_mapping, context, resolver)
            
            exec_mode = config.get("execution_mode", "await")
            req_context = context.get("__request_context__")
            
            result = await services.pdf_service.execute_flow_action(
                step_config={
                    "template_id": resolved_template,
                    "parent_object": config.get("target_object"),
                    "parent_record_id": record_id,
                    "record_data": context.get("Record"),
                    "execution_mode": exec_mode
                },
                context=req_context
            )
            
            # Save the generated file path into the flow context for subsequent steps
            output_var = config.get("output_variable")
            if output_var and result.get("file_path"):
                context[output_var] = result["file_path"]
                
            return context

        print("[Pdf Plugin] Service initialized and self-registered.")

    def get_routers(self) -> list:
        return [router]