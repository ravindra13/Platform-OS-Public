import copy
from foundation.flow.function_registry import FunctionRegistry

# --- DRY CONSTANTS FOR FLOW SCHEMAS ---
FLOW_VARIABLES_SCHEMA = {
    "type": "array",
    "description": "Variables used to store data during flow execution.",
    "items": {
        "type": "object",
        "properties": {
            "name": { "type": "string" },
            "data_type": { 
                "type": "string",
                "enum": ["STRING", "NUMBER", "BOOLEAN", "DATE", "DATETIME", "RECORD", "RECORD_COLLECTION", "REFERENCE"] 
            },
            "object_name": { "type": "string", "description": "Required if data_type is REFERENCE, RECORD, or RECORD_COLLECTION" },
            "is_input": { "type": "boolean" },
            "is_output": { "type": "boolean" },
            "expression": { 
                "type": "string", 
                "description": "Formula expression. If referencing triggering record fields, MUST use the 'Record.' prefix (e.g., 'Record.TotalAmount')." 
            }
        },
        "required": ["name", "data_type"]
    }
}

# 1. Update the BASE schema to use $ref for recursion
BASE_FLOW_STEPS_SCHEMA = {
    "type": "array",
    "description": "Sequential steps to execute. Branching and loops use nested step arrays.",
    "items": {
        "$ref": "#/$defs/step"
    },
    "$defs": {
        "step": {
            "type": "object",
            "properties": {
                "step_id": { "type": "string" },
                "function_name": { 
                    "type": "string", 
                    "enum": ["ASSIGN_VARIABLES", "FETCH_RECORDS", "CREATE_RECORD", "MODIFY_RECORD", "LOGICAL_BRANCH", "FOR_EACH"],
                    "description": "The primitive action to execute." 
                },
                "config": { 
                    "type": "object", 
                    "description": "Arguments required by the function_name.",
                    "properties": {
                        "assignments": {
                            "type": "array",
                            "description": "Required for ASSIGN_VARIABLES. MUST target fields using dot notation.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "field": { "type": "string" },
                                    "value": { "type": "string" },
                                    "operator": { "type": "string", "enum": ["=", "ADD", "SUBTRACT"] },
                                    "rightOperandType": { "type": "string", "enum": ["STRING", "FORMULA", "REFERENCE"] }
                                },
                                "required": ["field", "value"]
                            }
                        },
                        "target_object": { "type": "string" },
                        "output_variable": { "type": "string" },
                        "record_variable": { "type": "string" },
                        "record_id_expr": { "type": "string" },
                        "filters": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "field": { "type": "string" },
                                    "operator": { "type": "string", "enum": ["==", "!=", ">", "<", ">=", "<="] },
                                    "value": { "type": "string" },
                                    "rightOperandType": { "type": "string", "enum": ["STRING", "REFERENCE"] }
                                },
                                "required": ["field", "value"]
                            }
                        },
                        "filters_logic": { "type": "string", "enum": ["AND", "OR"] },
                        "limit_type": { "type": "string", "enum": ["FIRST_RECORD", "ALL_RECORDS"] },
                        "field_mappings": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "field": { "type": "string" },
                                    "value": { "type": "string" },
                                    "rightOperandType": { "type": "string", "enum": ["STRING", "REFERENCE", "FORMULA"] }
                                },
                                "required": ["field", "value"]
                            }
                        },
                        "updates": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "field": { "type": "string" },
                                    "value": { "type": "string" },
                                    "rightOperandType": { "type": "string", "enum": ["STRING", "REFERENCE", "FORMULA"] }
                                },
                                "required": ["field", "value"]
                            }
                        },
                        "condition_logic": { "type": "string", "enum": ["AND", "OR"] },
                        "condition": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "field": { "type": "string" },
                                    "operator": { "type": "string", "enum": ["==", "!=", ">", "<", ">=", "<=", "IS_NULL"] },
                                    "value": { "type": "string" },
                                    "rightOperandType": { "type": "string", "enum": ["STRING", "REFERENCE"] }
                                }
                            }
                        },
                        "list_key": { "type": "string" },
                        "item_alias": { "type": "string" }
                    }
                },
                "true_steps": { "type": "array", "items": { "$ref": "#/$defs/step" }, "description": "Executes if LOGICAL_BRANCH is true." },
                "false_steps": { "type": "array", "items": { "$ref": "#/$defs/step" }, "description": "Executes if LOGICAL_BRANCH is false." },
                "loop_steps": { "type": "array", "items": { "$ref": "#/$defs/step" }, "description": "Executes per item in a FOR_EACH loop." }
            },
            "required": ["step_id", "function_name", "config"]
        }
    }
}

def get_flow_steps_schema() -> dict:
    """
    Dynamically builds the AI schema by merging base steps with installed plugins.
    Call this function from your AI tools router/admin file.
    """
    schema = copy.deepcopy(BASE_FLOW_STEPS_SCHEMA)
    
    # Fetch dynamically registered actions (like SEND_EMAIL)
    available_actions = FunctionRegistry.get_available_actions()
    
    for action in available_actions:
        action_name = action["action_name"]
        ui_schema = action.get("ui_schema", {})
        
        # Inject into Enum inside the $defs structure
        enum_list = schema["$defs"]["step"]["properties"]["function_name"]["enum"]
        if action_name not in enum_list:
            enum_list.append(action_name)
            
        # Inject Config Fields based on UI schema inside $defs
        if "config_fields" in ui_schema:
            config_props = schema["$defs"]["step"]["properties"]["config"]["properties"]
            for field in ui_schema["config_fields"]:
                field_name = field["name"]
                raw_type = field.get("type", "string")

                if field_name not in config_props:
                    # --- NEW ARCHITECTURE: Handle Operand Objects ---
                    if raw_type == "operand":
                        config_props[field_name] = {
                            "type": "object",
                            "description": f"{field.get('label', field_name)}. Must be an operand mapping.",
                            "properties": {
                                "value": { "type": "string" },
                                "rightOperandType": { "type": "string", "enum": ["STRING", "REFERENCE", "FORMULA"] }
                            },
                            "required": ["value", "rightOperandType"]
                        }
                    else:
                        # Fallback for basic types
                        if raw_type in ["reference", "formula", "richtext", "email", "phone"]:
                            valid_json_type = "string"
                        elif raw_type in ["toggle"]:
                            valid_json_type = "boolean"
                        else:
                            valid_json_type = raw_type

                        config_props[field_name] = {
                            "type": valid_json_type,
                            "description": field.get("label", f"Configuration for {field_name}")
                        }
                    
    return schema