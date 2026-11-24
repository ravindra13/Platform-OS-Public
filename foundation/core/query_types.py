from typing import Set, Dict
from dataclasses import dataclass, field

@dataclass
class QueryNode:
    """Represents a node in the dependency execution tree."""
    object_name: str
    # The literal fields to fetch on this specific object (e.g., {'Id', 'Amount', 'Status'})
    fields: Set[str] = field(default_factory=set)
    # Child relationships mapped by the local field name (e.g., {'CustomerId': QueryNode(object_name='Customer')})
    relations: Dict[str, 'QueryNode'] = field(default_factory=dict)


from typing import List, Any, Literal, Optional, Union
from dataclasses import dataclass, field

Operator = Literal['=', '!=', '>', '<', 'IN']
LogicalOperator = Literal['AND', 'OR']

@dataclass
class QueryFilter:
    field: str
    operator: Operator
    value: Any


@dataclass
class LogicalFilter:
    """Groups multiple filters together using AND/OR logic for complex security constraints."""
    operator: LogicalOperator
    conditions: List[Union['QueryFilter', 'LogicalFilter']]


@dataclass
class AbstractQuery:
    object_name: str
    fields: List[str]
    # Filters can now be flat rules OR grouped logic
    filters: List[Union[QueryFilter, LogicalFilter]] = field(default_factory=list)
    limit: Optional[int] = 100
