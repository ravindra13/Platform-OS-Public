from typing import Dict, List, Literal, Optional, Any
from dataclasses import dataclass, field
from foundation.core.query_types import AbstractQuery  # <-- Added missing import

@dataclass
class QueryExecutionResult:
    query_ast: AbstractQuery
    compiled_sql: str
    target_node: str
    records: List[Dict[str, Any]]
