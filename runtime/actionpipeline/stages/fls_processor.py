from typing import Dict, Any
from foundation.security.security_policy_core import SecurityPolicyCore

class FieldSecurityProcessor:
    """Strips unauthorized fields based on Field-Level Security (FLS)."""

    def __init__(self, security_core: SecurityPolicyCore):
        self.security_core = security_core

    async def enforce(self, object_name: str, payload: Dict[str, Any], user_id: str) -> None:
        keys_to_remove = []
        for field_name in payload.keys():
            if field_name == 'Id':
                continue # 'Id' is always required for primary identification

            can_update = await self.security_core.has_field_access(user_id, object_name, field_name, 'UPDATE')
            if not can_update:
                print(f"[FLS Processor] Stripping restricted field '{field_name}' for User '{user_id}'")
                keys_to_remove.append(field_name)

        for k in keys_to_remove:
            del payload[k]
