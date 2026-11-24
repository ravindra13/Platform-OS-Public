# capabilities/migration/schema.py
from foundation.core.schema_types import ObjectDefinition, FieldDefinition, FieldType

sys_job_schema = ObjectDefinition(
    object_name="sys_Job",
    label="System Background Job",
    fields={
        "Id": FieldDefinition("Id", FieldType.STRING, required=True),
        "JobType": FieldDefinition("JobType", FieldType.STRING, required=True),
        "Status": FieldDefinition("Status", FieldType.STRING, required=True),
        "TargetObject": FieldDefinition("TargetObject", FieldType.STRING, required=False),
        "Payload": FieldDefinition("Payload", FieldType.JSON, required=False),
        "CreatedDate": FieldDefinition("CreatedDate", FieldType.DATETIME, required=True),
        "CreatedById": FieldDefinition("CreatedById", FieldType.STRING, required=True)
    }
)

def get_migration_schemas():
    """Returns the system schemas so the engine can reference them if needed."""
    return {
        "sys_Job": sys_job_schema
    }