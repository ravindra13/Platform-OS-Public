def get_create_flow_tool():
    """Generates the tool dynamically so it captures newly registered capability plugins."""
    return {
        "type": "function",
        "function": {
            "name": "create_flow",
            "description": "Creates a new backend automation flow for an object.",
            "parameters": {
                "type": "object",
                "properties": {
                    "flow_id": {"type": "string"},
                    "target_object": {"type": "string"},
                    "trigger_event": {"type": "string", "enum": ["ON_CREATE", "ON_UPDATE", "ON_CREATE_OR_UPDATE", "ON_DELETE"]},
                    "execution_phase": {"type": "string", "enum": ["BEFORE_SAVE", "AFTER_SAVE"]},
                    "variables": FLOW_VARIABLES_SCHEMA, 
                    "steps": get_flow_steps_schema()          
                },
                "required": ["flow_id", "target_object", "trigger_event", "steps"]
            }
        }
    }