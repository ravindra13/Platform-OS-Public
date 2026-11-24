LIST_METADATA_OBJECTS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_metadata_objects",
        "description": "Lists all available database object names and labels accessible to the user.",
        "parameters": {"type": "object", "properties": {}}
    }
}

GET_OBJECT_SCHEMA_TOOL = {
    "type": "function",
    "function": {
        "name": "get_object_schema",
        "description": "Retrieves field definitions and rules for a specific object.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string", "description": "PascalCase name of the object"}
            },
            "required": ["object_name"]
        }
    }
}

# UI_NAVIGATE_TOOL = {
#     "type": "function",
#     "function": {
#         "name": "ui_navigate",
#         "description": "Navigates the user's screen to a specific record, list view, or overlay.",
#         "parameters": {
#             "type": "object",
#             "properties": {
#                 "action": {"type": "string", "enum": ["VIEW_RECORD", "VIEW_LIST", "OPEN_MODAL"]},
#                 "target_object": {"type": "string", "description": "e.g., Account, User"},
#                 "record_id": {"type": "string", "description": "MANDATORY if action is VIEW_RECORD"},
#                 "modal_type": {"type": "string", "enum": ["IMPORT", "EXPORT", "SETTINGS"]}
#             },
#             "required": ["action", "target_object"]
#         }
#     }
# }