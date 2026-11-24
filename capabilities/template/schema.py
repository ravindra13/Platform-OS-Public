from foundation.core.schema_types import ObjectDefinition, FieldDefinition, FieldType

sys_message_template_schema = ObjectDefinition(
    object_name="sys_MessageTemplate",
    label="System Message Template",
    fields={
        "Id": FieldDefinition("Id", FieldType.STRING, required=True),
        "TemplateCode": FieldDefinition("TemplateCode", FieldType.STRING, required=True),
        "Channel": FieldDefinition("Channel", FieldType.STRING, required=True), 
        "Subject": FieldDefinition("Subject", FieldType.STRING, required=False),
        "Body": FieldDefinition("Body", FieldType.STRING, required=True),
    }
)

def get_template_schemas():
    return {"sys_MessageTemplate": sys_message_template_schema}