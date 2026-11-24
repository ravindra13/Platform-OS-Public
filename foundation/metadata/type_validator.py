# foundation/metadata/type_validator.py
from typing import Any
from foundation.core.schema_types import FieldDefinition, FieldType

class FieldTypeValidator:
    """Delegates validation to specific type methods dynamically."""

    @classmethod
    def validate(cls, field_name: str, value: Any, field_def: FieldDefinition) -> None:
        if value is None or value == "":
            return # Required checks happen at the schema engine level

        # Dynamically find the right method (e.g., _validate_string, _validate_picklist)
        method_name = f"_validate_{field_def.data_type.name.lower()}"
        validator_method = getattr(cls, method_name, cls._validate_fallback)

        # Execute the specific validation
        validator_method(field_name, value, field_def)

    @classmethod
    def _validate_string(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, str):
            raise ValueError(f"Validation Failed: {name} must be a STRING.")

    @classmethod
    def _validate_number(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, (int, float)):
            raise ValueError(f"Validation Failed: {name} must be a NUMBER.")

    @classmethod
    def _validate_boolean(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, bool):
            raise ValueError(f"Validation Failed: {name} must be a BOOLEAN.")

    @classmethod
    def _validate_picklist(cls, name: str, val: Any, f_def: FieldDefinition):
        if isinstance(f_def.config, dict) and "allowed_values" in f_def.config:
            allowed = f_def.config["allowed_values"]
            if val not in allowed:
                raise ValueError(
                    f"Invalid value '{val}' for field '{name}'. Allowed: {','.join(allowed)}"
                )

    @classmethod
    def _validate_fallback(cls, name: str, val: Any, f_def: FieldDefinition):
        # Gracefully handle types that don't have strict payload rules yet (like FORMULA)
        pass

    @classmethod
    def _validate_reference(cls, name: str, val: Any, f_def: FieldDefinition):
        # A Reference ID must be a string (e.g., 'CUST-001')
        if not isinstance(val, str):
            raise ValueError(f"Validation Failed: {name} must be a valid Reference ID STRING.")

    @classmethod
    def _validate_currency(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, (int, float)):
            raise ValueError(f"Validation Failed: {name} must be a valid CURRENCY number.")

    @classmethod
    def _validate_percent(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, (int, float)):
            raise ValueError(f"Validation Failed: {name} must be a valid PERCENT number.")
    @classmethod
    def _validate_email(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, str) or "@" not in str(val):
            raise ValueError(f"Validation Failed: {name} must be a valid EMAIL string.")

    @classmethod
    def _validate_phone(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, str):
            raise ValueError(f"Validation Failed: {name} must be a valid PHONE string.")

    @classmethod
    def _validate_url(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, str):
            raise ValueError(f"Validation Failed: {name} must be a valid URL string.")

    @classmethod
    def _validate_date(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, str):
            raise ValueError(f"Validation Failed: {name} must be a DATE string (YYYY-MM-DD).")

    @classmethod
    def _validate_datetime(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, str):
            raise ValueError(f"Validation Failed: {name} must be a DATETIME string.")

    @classmethod
    def _validate_time(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, str):
            raise ValueError(f"Validation Failed: {name} must be a TIME string.")

    @classmethod
    def _validate_geolocation(cls, name: str, val: Any, f_def: FieldDefinition):
        if not isinstance(val, str) or "," not in val:
            raise ValueError(f"Validation Failed: {name} must be a GEOLOCATION string ('lat,lng').")
