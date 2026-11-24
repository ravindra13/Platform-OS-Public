from .schemas_flow import FLOW_VARIABLES_SCHEMA, get_flow_steps_schema
from .schemas_view import MODULE_VIEW_MAPPINGS_SCHEMA

MODULE_BUILDER_TOOL = {
    "type": "function",
    "function": {
        "name": "generate_module_blueprint",
        "description": "Generates a complete JSON module blueprint (objects, fields, layouts) based on user requirements. Always use `get_object_schema` first if modifying existing objects.",
        "parameters": {
            "type": "object",
            "properties": {
                "module_name": { "type": "string" },
                "objects": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "object_name": { "type": "string" },
                            "label": { "type": "string" },
                            "show_in_nav": { "type": "boolean" },
                            "fields": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "field_name": { "type": "string" },
                                        "data_type": { "type": "string", "enum": ["STRING", "NUMBER", "BOOLEAN", "CURRENCY", "DATE", "REFERENCE", "PICKLIST", "FORMULA", "ROLLUP_SUMMARY"] },
                                        "required": { "type": "boolean" },
                                        "allowed_values": { 
                                            "type": "array", 
                                            "items": { "type": "string" },
                                            "description": "MANDATORY if data_type is 'PICKLIST'. Provide a list of 3-6 logical options." 
                                        },
                                        "expression": { "type": "string" },
                                        "return_type": { "type": "string" },
                                        "target_object": { 
                                            "type": "string",
                                            "description": "MANDATORY if data_type is 'REFERENCE'. The exact object_name of the parent object being referenced."
                                        },
                                        "relationship_type": { "type": "string", "enum": ["LOOKUP", "MASTER_DETAIL"] },
                                        "deletion_behavior": { "type": "string", "enum": ["CASCADE", "SET_NULL", "RESTRICT"] },
                                        "child_object": { "type": "string" },
                                        "relationship_field": { "type": "string" },
                                        "operation": { "type": "string", "enum": ["COUNT", "SUM", "MIN", "MAX"] },
                                        "target_field": { "type": "string" },
                                        "filter_expression": { "type": "string" }
                                    },
                                    "required": ["field_name", "data_type", "required"],
                                    "additionalProperties": False
                                }
                            },
                            "capabilities": { 
                                "type": "array", 
                                "description": "Select up to 3 optional capabilities to display on the record rail. ONLY use these exact strings.",
                                "items": { 
                                    "type": "string",
                                    "enum": ["record_chat", "file_attachments", "audit_trail"]
                                } 
                            },
                            "view_mappings": MODULE_VIEW_MAPPINGS_SCHEMA,
                            "validation_rules": {
                                "type": "array",
                                "description": "Rules that evaluate to TRUE when there is an error.",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "rule_id": { "type": "string", "description": "Unique identifier, e.g., end_date_before_start" },
                                        "error_condition_expr": { "type": "string", "description": "A logical expression string that evaluates to TRUE if the data is invalid. Use standard operators (and, or, <, >). For null checks, you MUST use IS_NULL(Field) instead of checking against None/null. For date macros, use TODAY(). " },
                                        "error_message": { "type": "string", "description": "The error text shown to the user" }
                                    },
                                    "required": ["rule_id", "error_condition_expr", "error_message"]
                                }
                            },
                            "flows": { 
                                "type": "array", 
                                "description": "Automated workflows triggered on data changes. Use this to automate backend logic.",
                                "items": { 
                                    "type": "object",
                                    "properties": {
                                        "flow_id": { "type": "string", "description": "Unique identifier, e.g., 'calculate_total_discount'" },
                                        "target_object": { "type": "string", "description": "The object this flow runs on" },
                                        "trigger_event": { "type": "string", "enum": ["ON_CREATE", "ON_UPDATE", "ON_CREATE_OR_UPDATE", "ON_DELETE"] },
                                        "execution_phase": { "type": "string", "enum": ["BEFORE_SAVE", "AFTER_SAVE"] },
                                        "active": { "type": "boolean" },
                                        "variables": FLOW_VARIABLES_SCHEMA,
                                        "steps": get_flow_steps_schema()
                                    },
                                    "required": ["flow_id", "target_object", "trigger_event", "steps"]
                                } 
                            }
                        },
                        "required": ["object_name", "label", "fields"]
                    }
                }
            },
            "required": ["module_name", "objects"]
        }
    }
}