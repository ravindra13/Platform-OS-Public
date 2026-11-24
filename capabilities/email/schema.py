from foundation.core.schema_types import ObjectDefinition, FieldDefinition, FieldType

sys_email_template_schema = ObjectDefinition(
    object_name="sys_EmailTemplate",
    label="Email Template",
    fields={
        "Id": FieldDefinition("Id", FieldType.STRING, required=True),
        "Name": FieldDefinition("Name", FieldType.STRING, required=True),
        "TargetObject": FieldDefinition("TargetObject", FieldType.STRING, required=True),
        "Subject": FieldDefinition("Subject", FieldType.STRING, required=True),
        "HtmlBody": FieldDefinition("HtmlBody", FieldType.STRING, required=True),
    }
)

sys_email_log_schema = ObjectDefinition(
    object_name="sys_EmailLog",
    label="Email Log",
    fields={
        "Id": FieldDefinition("Id", FieldType.STRING, required=True),
        "ParentObjectType": FieldDefinition("ParentObjectType", FieldType.STRING, required=False),
        "ParentRecordId": FieldDefinition("ParentRecordId", FieldType.STRING, required=False),
        "Recipient": FieldDefinition("Recipient", FieldType.STRING, required=True),
        "Status": FieldDefinition("Status", FieldType.STRING, required=True),
        "SentDate": FieldDefinition("SentDate", FieldType.DATETIME, required=True),
    }
)

def get_email_schemas():
    return {
        "sys_EmailTemplate": sys_email_template_schema,
        "sys_EmailLog": sys_email_log_schema
    }