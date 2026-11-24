from typing import List
from foundation.core.query_types import QueryNode
from foundation.core.schema_types import FieldType, ReferenceConfig

class QueryParser:
    """
    Domain Service: Parses dot-notation query strings into a validated QueryNode dependency graph.
    Strictly independent of database fetch logic.
    """

    def __init__(self, schema_engine):
        self.schema_engine = schema_engine

    async def parse_query(self, base_object_name: str, requested_fields: List[str]) -> QueryNode:
        root_node = QueryNode(object_name=base_object_name)

        base_blueprint = await self.schema_engine.get_object_blueprint(base_object_name)
        if not base_blueprint:
            raise ValueError(f"Parser Error: Object '{base_object_name}' does not exist.")

        # # Always include the ID for relational mapping later
        root_node.fields.add('Id')

        for field_path in requested_fields:
            if not field_path.strip():
                continue
            await self._resolve_path(root_node, base_blueprint, field_path.split('.'))

        return root_node

    async def _resolve_path(self, current_node: QueryNode, blueprint, path_parts: List[str]) -> None:
        current_field = path_parts[0]
        # # 1. NAVIGATION PROPERTY RESOLVER
        # Check if the exact field exists. If not, check if it's a navigation property requesting an 'Id' field
        actual_field_name = current_field
        if actual_field_name not in blueprint.fields:
            if f"{current_field}Id" in blueprint.fields:
                actual_field_name = f"{current_field}Id"
            else:
                raise ValueError(
                    f"Parser Error: Field '{current_field}' not found on object '{blueprint.object_name}'."
                )

        field_def = blueprint.fields[actual_field_name]

        # # Base Case: It's the end of the path
        if len(path_parts) == 1:
            current_node.fields.add(actual_field_name)
            return

        # # Relational Case: Path continues, so this field MUST be a reference
        if field_def.data_type != FieldType.REFERENCE or not isinstance(field_def.config, ReferenceConfig):
            raise ValueError(
                f"Parser Error: Cannot traverse dot-notation through '{current_field}' "
                f"because it is not a REFERENCE field."
            )

        target_object = field_def.config.target_object

        # # Initialize the branch if we haven't visited this relation yet
        # We store it under the actual_field_name (e.g., 'CustomerId') so the Data Stitcher knows what FK to pull
        if actual_field_name not in current_node.relations:
            current_node.relations[actual_field_name] = QueryNode(object_name=target_object, fields={'Id'})
        # # We MUST tell the base object to fetch the Foreign Key!
        current_node.fields.add(actual_field_name)

        target_blueprint = await self.schema_engine.get_object_blueprint(target_object)
        if not target_blueprint:
            raise ValueError(f"Parser Error: Target blueprint '{target_object}' is missing.")

        # # Recursively resolve the rest of the path on the target object
        await self._resolve_path(
            current_node.relations[actual_field_name],
            target_blueprint,
            path_parts[1:]
        )
