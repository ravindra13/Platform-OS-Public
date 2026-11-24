from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, List

@dataclass
class AuditDelta:
    field_name: str
    old_value: Any
    new_value: Any

@dataclass
class LedgerEntry:
    transaction_id: str
    tenant_id: str
    object_name: str
    record_id: str
    actor_id: str
    action: str # CREATE, UPDATE, SOFT_DELETE, HARD_DELETE
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    deltas: List[AuditDelta] = field(default_factory=list)
