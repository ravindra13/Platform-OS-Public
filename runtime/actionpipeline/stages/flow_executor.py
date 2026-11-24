import dataclasses

class ObjectFlowExecutor:
    def __init__(self, flow_engine):
        self.flow_engine = flow_engine

    async def execute(self, blueprint, object_name, payload, existing_record, context, hydrated_context=None, execution_phase="BEFORE_SAVE", internal_save_fn=None):
        flows_in_memory = getattr(blueprint, 'flows', [])



        for flow_def in flows_in_memory:
            phase = flow_def.get("execution_phase", "BEFORE_SAVE") if isinstance(flow_def, dict) else getattr(flow_def, 'execution_phase', "BEFORE_SAVE")

            if phase != execution_phase:
                continue

            # --- ARCHITECTURAL FIX: RELY ON DB STATE, NOT PAYLOAD ID ---
            is_new_record = not bool(existing_record)
            trigger_evt = flow_def.get("trigger_event", "ON_CREATE_OR_UPDATE") if isinstance(flow_def, dict) else getattr(flow_def, 'trigger_event', "ON_CREATE_OR_UPDATE")



            
            is_create_match = (trigger_evt == "ON_CREATE" and is_new_record)
            is_update_match = (trigger_evt == "ON_UPDATE" and not is_new_record)
            is_save_match = (trigger_evt in ["ON_SAVE", "ON_CREATE_OR_UPDATE"])

            if is_create_match or is_update_match or is_save_match:

                flow_context = {
                    "Record": {**(hydrated_context or {}), **(existing_record or {}), **payload},
                    "__tenant_id__": context.user.tenant_id,
                    "__user_id__": context.user.user_id,
                    "__internal_save_fn__": internal_save_fn,
                    "__request_context__": context
                }

                # variables = getattr(flow_def, 'variables', [])
                # flow_context["__formulas__"] = {}
                
                # for var in (variables if isinstance(variables, list) else []):
                #     var_name = var.get("name") if isinstance(var, dict) else var.name
                #     var_type = var.get("data_type") if isinstance(var, dict) else var.data_type
                #     expression = var.get("expression") if isinstance(var, dict) else getattr(var, 'expression', None)

                #     if var_type == "RECORD":
                #         flow_context[var_name] = {}
                #     elif var_type == "RECORD_COLLECTION":
                #         flow_context[var_name] = []
                    
                #     if expression:
                #         flow_context["__formulas__"][var_name] = expression

                variables = getattr(flow_def, 'variables', [])
                flow_context["__formulas__"] = {}
                
                for var in variables:
                    var_name = var.name
                    var_type = var.data_type
                    expression = getattr(var, 'expression', None)

                    if var_type == "RECORD":
                        flow_context[var_name] = {}
                    elif var_type == "RECORD_COLLECTION":
                        flow_context[var_name] = []
                    
                    if expression:
                        flow_context["__formulas__"][var_name] = expression

                flow_dict = flow_def if isinstance(flow_def, dict) else (dataclasses.asdict(flow_def) if dataclasses.is_dataclass(flow_def) else __import__('json').loads(__import__('json').dumps(flow_def, default=lambda o: o.__dict__)))

                updated_context = await self.flow_engine.execute_flow(flow_dict, flow_context)



                if execution_phase == "BEFORE_SAVE":
                    modified_record = updated_context.get("Record", {})
                    blueprint_fields = getattr(blueprint, 'fields', {})
                    
                    for key, value in modified_record.items():
                        # Guard: Only process valid schema fields
                        if key in blueprint_fields and key != "Id" and not key.startswith('__'): 
                            
                            # ARCHITECTURE FIX: The Smart Diff
                            original_db_value = (existing_record or {}).get(key)
                            
                            # Keep it if the flow changed it, OR if the user explicitly sent it
                            if value != original_db_value or key in payload:
                                payload[key] = value