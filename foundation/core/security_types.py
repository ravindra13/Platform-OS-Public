from typing import Dict, Optional, Literal
from dataclasses import dataclass, field

AccessLevel = Literal['READ', 'EDIT', 'ALL']
CrudAction = Literal['CREATE', 'READ', 'UPDATE', 'DELETE']

@dataclass
class ObjectPermission:
    allow_create: bool
    allow_read: bool
    allow_update: bool
    allow_delete: bool
    allow_view_all: bool = False  # THE BYPASS FLAGS
    allow_modify_all: bool = False

@dataclass
class FieldPermission:
    allow_read: bool
    allow_update: bool

@dataclass
class Profile:
    profile_id: str
    profile_name: str # e.g., 'Standard User', 'System Admin'
    # Map of ObjectName -> ObjectPermission
    object_permissions: Dict[str, ObjectPermission] = field(default_factory=dict)
    # Map of ObjectName.FieldName -> FieldPermission
    field_permissions: Dict[str, FieldPermission] = field(default_factory=dict)

@dataclass
class User:
    user_id: str
    name: str
    profile_id: str
    tenant_id: str # <-- Enforce multi-tenancy at the identity layer
    role_id: Optional[str] = None # For hierarchical record sharing

@dataclass
class RecordShare:
    record_id: str
    user_id: str
    access_level: AccessLevel
