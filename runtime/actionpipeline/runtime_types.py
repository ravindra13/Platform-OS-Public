from typing import Dict, List, Literal, Optional
from dataclasses import dataclass, field

@dataclass
class SaveResult:
    record_id: Optional[str]
    success: bool
    errors: List[str] = field(default_factory=list)

@dataclass
class DeleteResult:
    record_id: str
    success: bool
    errors: List[str] = field(default_factory=list)
