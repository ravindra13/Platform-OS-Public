from typing import Dict, List
from dataclasses import dataclass
from foundation.core.schema_types import DeletionBehavior

@dataclass
class DependencyNode:
    child_object: str
    child_field: str
    behavior: DeletionBehavior

class RelationshipGraphMapper:
    """
    In-memory graph tracking entity dependencies and referential integrity rules.
    """

    def __init__(self):
        self._graph: Dict[str, List[DependencyNode]] = {}

    def register_relationship(
        self,
        child_object: str,
        child_field: str,
        target_object: str,
        behavior: DeletionBehavior
    ) -> None:
        if target_object not in self._graph:
            self._graph[target_object] = []

        node = DependencyNode(
            child_object=child_object,
            child_field=child_field,
            behavior=behavior
        )
        self._graph[target_object].append(node)
        print(f"[Graph Mapper] Registered: {child_object}.{child_field} -> {target_object} ({behavior.name})")

    def get_dependencies(self, target_object: str) -> List[DependencyNode]:
        """Returns all child objects dependent on the target parent object."""
        return self._graph.get(target_object, [])


    def unregister_relationship(self, child_object: str, child_field: str) -> None:
        """Removes a specific field's relationship from the graph to maintain sync during field deletion."""
        for target_obj, nodes in self._graph.items():
            self._graph[target_obj] = [
                n for n in nodes 
                if not (n.child_object == child_object and n.child_field == child_field)
            ]
        print(f"[Graph Mapper] Unregistered: {child_object}.{child_field}")

    def unregister_object(self, child_object: str) -> None:
        """Removes all relationships where the deleted object was acting as a child."""
        for target_obj, nodes in self._graph.items():
            self._graph[target_obj] = [n for n in nodes if n.child_object != child_object]
        print(f"[Graph Mapper] Unregistered all outgoing relationships for: {child_object}")