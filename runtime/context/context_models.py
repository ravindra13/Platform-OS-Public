from typing import Dict, Any, Literal
from dataclasses import dataclass, field, replace
from foundation.core.security_types import ObjectPermission, FieldPermission

ExecutionMode = Literal['USER', 'SYSTEM']

@dataclass
class UserContext:
    tenant_id: str
    user_id: str
    profile_id: str
    cached_object_perms: Dict[str, ObjectPermission] = field(default_factory=dict)
    cached_field_perms: Dict[str, FieldPermission] = field(default_factory=dict)

@dataclass
class RequestContext:
    transaction_id: str
    user: UserContext
    mode: ExecutionMode = 'USER'

    def switch_mode(self, new_mode: ExecutionMode) -> 'RequestContext':
        """Returns a cloned RequestContext with the elevated/demoted execution mode."""
        print(f"[Mode Switcher] Cloning context for {new_mode} execution")
        return replace(self, mode=new_mode)
