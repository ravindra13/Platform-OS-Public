from .schemas_flow import FLOW_VARIABLES_SCHEMA, get_flow_steps_schema
from .schemas_view import SINGLE_VIEW_CONFIG_SCHEMA

UPDATE_VALIDATION_RULE_TOOL = {
    "type": "function",
    "function": {
        "name": "update_validation_rule",
        "description": "Modifies an existing validation rule's condition or error message.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"},
                "rule_id": {"type": "string"},
                "error_condition_expr": {"type": "string", "description": "Python syntax ('and', 'or', 'None')"},
                "error_message": {"type": "string"}
            },
            "required": ["object_name", "rule_id"]
        }
    }
}

# tools_admin.py

UPDATE_SYSTEM_LAYOUT_TOOL = {
    "type": "function",
    "function": {
        "name": "update_system_layout",
        "description": "Updates a core, default system layout for an object (e.g., the default 'kanban', 'list', or 'detail' view). These map to the view_mappings backend dictionary.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"},
                "layout_name": {
                    "type": "string", 
                    "description": "The name of the core layout to update (e.g., 'kanban', 'list', 'detail')"
                },
                "config": SINGLE_VIEW_CONFIG_SCHEMA # References the flat schema
            },
            "required": ["object_name", "layout_name", "config"]
        }
    }
}

CREATE_CUSTOM_VIEW_TOOL = {
    "type": "function",
    "function": {
        "name": "create_custom_view",
        # "description": "Creates a distinct, custom-tabbed view for specific user roles. These map to the saved_views backend list.",
        "description": "Creates a distinct, custom-tabbed view for specific user roles. CRITICAL RULE: You CANNOT create a custom view unless the base layout (view_type) already exists in the system. If it does not exist, you MUST call update_system_layout first to define the base layout.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"},
                "view_id": {"type": "string", "description": "A unique identifier for this custom view (e.g., 'SALES_KANBAN')"},
                "tab_label": {"type": "string", "description": "The human-readable name on the tab"},
                "view_type": {"type": "string", "description": "The frontend renderer (e.g., 'kanban', 'list', 'gantt')"},
                "visible_to_roles": {"type": "array", "items": {"type": "string"}},
                "config": SINGLE_VIEW_CONFIG_SCHEMA # References the flat schema
            },
            "required": ["object_name", "view_id", "tab_label", "view_type", "config"]
        }
    }
}

# CREATE_FLOW_TOOL = {
#     "type": "function",
#     "function": {
#         "name": "create_flow",
#         "description": "Creates a new backend automation flow for an object.",
#         "parameters": {
#             "type": "object",
#             "properties": {
#                 "flow_id": {"type": "string"},
#                 "target_object": {"type": "string"},
#                 "trigger_event": {"type": "string", "enum": ["ON_CREATE", "ON_UPDATE", "ON_CREATE_OR_UPDATE", "ON_DELETE"]},
#                 "execution_phase": {"type": "string", "enum": ["BEFORE_SAVE", "AFTER_SAVE"]},
#                 "variables": FLOW_VARIABLES_SCHEMA, 
#                 "steps": get_flow_steps_schema()          
#             },
#             "required": ["flow_id", "target_object", "trigger_event", "steps"]
#         }
#     }
# }

# def get_create_flow_tool():
#     """Generates the tool dynamically so it captures newly registered capability plugins."""
#     return {
#         "type": "function",
#         "function": {
#             "name": "create_flow",
#             "description": "Creates a new backend automation flow for an object.",
#             "parameters": {
#                 "type": "object",
#                 "properties": {
#                     "flow_id": {"type": "string"},
#                     "target_object": {"type": "string"},
#                     "trigger_event": {"type": "string", "enum": ["ON_CREATE", "ON_UPDATE", "ON_CREATE_OR_UPDATE", "ON_DELETE"]},
#                     "execution_phase": {"type": "string", "enum": ["BEFORE_SAVE", "AFTER_SAVE"]},
#                     "variables": FLOW_VARIABLES_SCHEMA, 
#                     "steps": get_flow_steps_schema()          
#                 },
#                 "required": ["flow_id", "target_object", "trigger_event", "steps"]
#             }
#         }
#     }

def get_create_flow_tool():
    """Generates the tool dynamically so it captures newly registered capability plugins."""
    steps_schema = get_flow_steps_schema()
    
    # Extract $defs so we can move it to the root
    defs = steps_schema.pop("$defs", {})

    return {
        "type": "function",
        "function": {
            "name": "create_flow",
            "description": "Creates a new backend automation flow for an object.",
            "parameters": {
                "type": "object",
                "$defs": defs,  # <-- CRITICAL FIX: Place $defs at the parameters root
                "properties": {
                    "flow_id": {"type": "string"},
                    "target_object": {"type": "string"},
                    "trigger_event": {"type": "string", "enum": ["ON_CREATE", "ON_UPDATE", "ON_CREATE_OR_UPDATE", "ON_DELETE"]},
                    "execution_phase": {"type": "string", "enum": ["BEFORE_SAVE", "AFTER_SAVE"]},
                    "variables": FLOW_VARIABLES_SCHEMA, 
                    "steps": steps_schema          
                },
                "required": ["flow_id", "target_object", "trigger_event", "steps"]
            }
        }
    }

CREATE_OBJECT_TOOL = {
    "type": "function",
    "function": {
        "name": "create_object",
        "description": "Creates a new database object (table).",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string", "description": "PascalCase identifier (e.g., SupportTicket)"},
                "label": {"type": "string", "description": "Human-readable name (e.g., Support Ticket)"}
            },
            "required": ["object_name", "label"]
        }
    }
}

ADD_FIELD_TOOL = {
    "type": "function",
    "function": {
        "name": "add_field",
        "description": "Adds a new field (column) to an existing object.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"},
                "field_name": {"type": "string"},
                "data_type": {
                    "type": "string",
                    "enum": [
                        "STRING", "NUMBER", "BOOLEAN", "REFERENCE", "PICKLIST", 
                        "FORMULA", "ROLLUP_SUMMARY", "DATE", "DATETIME", "TIME", 
                        "CURRENCY", "PERCENT", "EMAIL", "PHONE", "URL", "GEOLOCATION"
                    ]
                },
                "required": {"type": "boolean"},
                "allowed_values": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "MANDATORY if data_type is 'PICKLIST'. Provide a list of logical options."
                },
                "target_object": {
                    "type": "string",
                    "description": "MANDATORY if data_type is 'REFERENCE'. The exact name of the parent object."
                },
                # "expression": { "type": "string", "description": "MANDATORY if data_type is FORMULA. Use AST-compatible expressions." },
                # "return_type": { "type": "string", "description": "MANDATORY if data_type is FORMULA." },


                "expression": {
                    "type": "string",
                    "description": (
                        "MANDATORY if data_type is FORMULA. A single expression using field names exactly as they appear on the object. "
                        "Operators: + - * / == != > < >= <= and or not. "
                        "Functions: IF(condition, then, else), UPPER(x), LOWER(x), CONTAINS(text, part), BEGINS_WITH(text, prefix), "
                        "IS_NULL(x), TODAY(), NOW(). "
                        "Dates are ISO text (YYYY-MM-DD). A date plus or minus a number gives a new date in days, e.g. PickupDate + 15. "
                        "To read a field on a parent record, use the lookup field's name without 'Id', then a dot, e.g. Order.PickupDate. "
                        "Text values use single quotes. "
                        "Examples: Total - Advance   |   PickupDate + 15   |   IF(AlterationDate <= Order.FreeAlterationUntil, 'Free', 'Chargeable')"
                    )
                },
                "return_type": {
                    "type": "string",
                    "description": "MANDATORY if data_type is FORMULA. One of: STRING, NUMBER, CURRENCY, DATE, BOOLEAN."
                },



                "child_object": { "type": "string", "description": "MANDATORY if data_type is ROLLUP_SUMMARY." },
                "relationship_field": { "type": "string", "description": "MANDATORY if data_type is ROLLUP_SUMMARY." },
                "operation": { "type": "string", "enum": ["COUNT", "SUM", "MIN", "MAX"], "description": "MANDATORY if data_type is ROLLUP_SUMMARY." },
                "target_field": { "type": "string", "description": "MANDATORY if data_type is ROLLUP_SUMMARY (except for COUNT)." }
            },
            "required": ["object_name", "field_name", "data_type"]
        }
    }
}

ADD_VALIDATION_RULE_TOOL = {
    "type": "function",
    "function": {
        "name": "add_validation_rule",
        "description": "Adds a new validation rule to a database object to enforce data integrity.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string", "description": "The target object (e.g., Invoice)"},
                "rule_id": {"type": "string", "description": "A unique identifier for the rule (e.g., amount_must_be_positive)"},
                "error_condition_expr": {"type": "string", "description": "A logical expression string that evaluates to TRUE if the data is invalid. Use standard operators (and, or, <, >). For null checks, you MUST use IS_NULL(Field) instead of checking against None/null. For date macros, use TODAY()."},
                "error_message": {"type": "string", "description": "The error text shown to the user"}
            },
            "required": ["object_name", "rule_id", "error_condition_expr", "error_message"]
        }
    }
}

UPDATE_OBJECT_PERMISSIONS_TOOL = {
    "type": "function",
    "function": {
        "name": "update_object_permissions",
        "description": "Modifies Object-Level Security (CRUD) for a specific user profile.",
        "parameters": {
            "type": "object",
            "properties": {
                "profile_id": {"type": "string"},
                "object_name": {"type": "string"},
                "allow_create": {"type": "boolean"},
                "allow_read": {"type": "boolean"},
                "allow_update": {"type": "boolean"},
                "allow_delete": {"type": "boolean"}
            },
            "required": ["profile_id", "object_name"]
        }
    }
}

UPDATE_OBJECT_CAPABILITIES_TOOL = {
    "type": "function",
    "function": {
        "name": "update_object_capabilities",
        "description": "Enables or disables record-level capabilities (chat, files, audit) for an object.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"},
                "capabilities": { 
                    "type": "array", 
                    "description": "Select up to 3 optional capabilities to display on the record rail.",
                    "items": { 
                        "type": "string",
                        "enum": ["record_chat", "file_attachments", "audit_trail"]
                    } 
                }
            },
            "required": ["object_name", "capabilities"]
        }
    }
}

UPDATE_FIELD_SECURITY_TOOL = {
    "type": "function",
    "function": {
        "name": "update_field_security",
        "description": "Modifies Field-Level Security (FLS) to restrict read/update access to a specific field.",
        "parameters": {
            "type": "object",
            "properties": {
                "profile_id": {"type": "string"},
                "object_name": {"type": "string"},
                "field_name": {"type": "string"},
                "allow_read": {"type": "boolean"},
                "allow_update": {"type": "boolean"}
            },
            "required": ["profile_id", "object_name", "field_name", "allow_read", "allow_update"]
        }
    }
}

DELETE_OBJECT_TOOL = {
    "type": "function",
    "function": {
        "name": "delete_object",
        "description": "Drops an entire object (table) and all its data. Will fail if protected by RESTRICT dependencies.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"}
            },
            "required": ["object_name"]
        }
    }
}

DELETE_FIELD_TOOL = {
    "type": "function",
    "function": {
        "name": "delete_field",
        "description": "Drops a specific field (column) from an object.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"},
                "field_name": {"type": "string"}
            },
            "required": ["object_name", "field_name"]
        }
    }
}

DELETE_USER_TOOL = {
    "type": "function",
    "function": {
        "name": "delete_user",
        "description": "Fully offboards a user by wiping them from both the identity/security layer and the metadata layer.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"}
            },
            "required": ["user_id"]
        }
    }
}

DELETE_PROFILE_TOOL = {
    "type": "function",
    "function": {
        "name": "delete_profile",
        "description": "Fully deletes a security profile from both the identity layer and the metadata layer.",
        "parameters": {
            "type": "object",
            "properties": {
                "profile_id": {"type": "string"}
            },
            "required": ["profile_id"]
        }
    }
}

DEPLOY_MODULE_BLUEPRINT_TOOL = {
    "type": "function",
    "function": {
        "name": "deploy_module_blueprint",
        "description": "Deploys an entire object schema, its fields, and its profile permissions in a single transaction. Use this exclusively to execute the build once the client passes the Proposal Gate.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string", "description": "PascalCase identifier (e.g., SupportTicket)"},
                "label": {"type": "string", "description": "Human-readable name (e.g., Support Ticket)"},
                "fields": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "field_name": {"type": "string"},
                            "data_type": {
                                "type": "string",
                                "enum": ["STRING", "NUMBER", "BOOLEAN", "REFERENCE", "PICKLIST", "DATE", "CURRENCY"]
                            },
                            "required": {"type": "boolean"},
                            "allowed_values": {"type": "array", "items": {"type": "string"}},
                            "target_object": {"type": "string"}
                        },
                        "required": ["field_name", "data_type"]
                    }
                },
                "permissions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "profile_id": {"type": "string"},
                            "allow_create": {"type": "boolean"},
                            "allow_read": {"type": "boolean"},
                            "allow_update": {"type": "boolean"},
                            "allow_delete": {"type": "boolean"}
                        },
                        "required": ["profile_id"]
                    }
                }
            },
            "required": ["object_name", "label", "fields"]
        }
    }
}