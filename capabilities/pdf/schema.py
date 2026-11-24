from foundation.core.schema_types import ObjectDefinition, FieldDefinition, FieldType

sys_document_log_schema = ObjectDefinition(
    object_name="sys_DocumentLog",
    label="Document Generation Log",
    fields={
        "Id": FieldDefinition("Id", FieldType.STRING, required=True),
        "ParentObjectType": FieldDefinition("ParentObjectType", FieldType.STRING, required=False),
        "ParentRecordId": FieldDefinition("ParentRecordId", FieldType.STRING, required=False),
        "FileId": FieldDefinition("FileId", FieldType.STRING, required=True),
        "FilePath": FieldDefinition("FilePath", FieldType.STRING, required=True),
        "Status": FieldDefinition("Status", FieldType.STRING, required=True),
        "GeneratedDate": FieldDefinition("GeneratedDate", FieldType.DATETIME, required=True),
    }
)

def get_pdf_schemas():
    return {
        "sys_DocumentLog": sys_document_log_schema
    }