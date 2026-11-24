EXECUTE_DATA_QUERY_TOOL = {
    "type": "function",
    "function": {
        "name": "execute_data_query",
        "description": "Queries database records for an object with optional field selection and filters.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"},
                "fields": {"type": "array", "items": {"type": "string"}},
                "filters": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "field": {"type": "string"},
                            "operator": {"type": "string", "enum": ["=", "!=", ">", "<", "IN", "LIKE", "ILIKE"]},
                            "value": {}
                        },
                        "required": ["field", "operator", "value"]
                    }
                }
            },
            "required": ["object_name", "fields"]
        }
    }
}

SAVE_DATA_RECORDS_TOOL = {
    "type": "function",
    "function": {
        "name": "save_data_records",
        "description": "Creates or updates data records for a specific object.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string"},
                "records": {
                    "type": "array",
                    "description": "List of record dicts. Include 'Id' to update, omit to create.",
                    "items": {"type": "object"}
                }
            },
            "required": ["object_name", "records"]
        }
    }
}

DELETE_RECORDS_TOOL = {
    "type": "function",
    "function": {
        "name": "delete_records",
        "description": "Deletes business records from a specific object. Use this when a user asks to remove, delete, or wipe data.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string", "description": "The name of the object (e.g., Account)"},
                "record_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "A list of record IDs to delete."
                }
            },
            "required": ["object_name", "record_ids"]
        }
    }
}

REVOKE_RECORD_SHARE_TOOL = {
    "type": "function",
    "function": {
        "name": "revoke_record_share",
        "description": "Revokes a user's explicit sharing access to a specific record.",
        "parameters": {
            "type": "object",
            "properties": {
                "record_id": {"type": "string"},
                "target_user_id": {"type": "string", "description": "The ID of the user losing access."}
            },
            "required": ["record_id", "target_user_id"]
        }
    }
}

SHARE_RECORD_TOOL = {
    "type": "function",
    "function": {
        "name": "share_record",
        "description": "Explicitly shares a specific record with another user, granting them READ, EDIT, or ALL access.",
        "parameters": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string", "description": "The name of the object (e.g., Account)"},
                "record_id": {"type": "string"},
                "target_user_id": {"type": "string", "description": "The ID of the user receiving access."},
                "access_level": {
                    "type": "string", 
                    "enum": ["READ", "EDIT", "ALL"],
                    "description": "The level of access to grant."
                }
            },
            "required": ["object_name", "record_id", "target_user_id", "access_level"]
        }
    }
}