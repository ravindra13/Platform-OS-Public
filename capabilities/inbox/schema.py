from foundation.core.schema_types import ObjectDefinition, FieldDefinition, FieldType

sys_thread_schema = ObjectDefinition(
    object_name="sys_Thread",
    label="System Thread",
    fields={
        "Id": FieldDefinition("Id", FieldType.STRING, required=True),
        "ParentObjectType": FieldDefinition("ParentObjectType", FieldType.STRING, required=True),
        "ParentRecordId": FieldDefinition("ParentRecordId", FieldType.STRING, required=True),
        "CreatedDate": FieldDefinition("CreatedDate", FieldType.DATETIME, required=True),
        "CreatedById": FieldDefinition("CreatedById", FieldType.STRING, required=True)
    }
)

sys_message_schema = ObjectDefinition(
    object_name="sys_Message",
    label="System Message",
    fields={
        "Id": FieldDefinition("Id", FieldType.STRING, required=True),
        "ThreadId": FieldDefinition("ThreadId", FieldType.STRING, required=True),
        "SenderId": FieldDefinition("SenderId", FieldType.STRING, required=True),
        "Body": FieldDefinition("Body", FieldType.STRING, required=True),
        "Timestamp": FieldDefinition("Timestamp", FieldType.DATETIME, required=True),
        "CreatedDate": FieldDefinition("CreatedDate", FieldType.DATETIME, required=True),
        "CreatedById": FieldDefinition("CreatedById", FieldType.STRING, required=True)
    }
)

def get_inbox_schemas():
    """Returns the system schemas so the engine can reference them if needed."""
    return {
        "sys_Thread": sys_thread_schema,
        "sys_Message": sys_message_schema
    }
