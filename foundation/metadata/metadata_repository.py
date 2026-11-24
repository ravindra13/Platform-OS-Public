from typing import Optional, List
from foundation.core.schema_types import ObjectDefinition
from foundation.core.database_adapter import DatabaseAdapter

class MetadataRepository:
    """
    Repository bridge for schema metadata operations.
    Delegates persistence directly to the injected DatabaseAdapter.
    """

    def __init__(self, db_adapter: DatabaseAdapter):
        self._db = db_adapter

    async def list_schemas(self) -> List[str]:
        """Delegates schema discovery directly through the DatabaseAdapter interface."""
        return await self._db.list_all_schema_names()

    async def save_schema(self, schema: ObjectDefinition) -> None:
        await self._db.save_schema(schema)

    async def get_schema(self, object_name: str) -> Optional[ObjectDefinition]:
        return await self._db.get_schema(object_name)

    async def get_all_schemas(self) -> List[ObjectDefinition]:
        """Fetches all registered object schema blueprints from storage."""
        if hasattr(self._db, 'get_all_schemas'):
            return await self._db.get_all_schemas()
        return []

    async def delete_schema(self, object_name: str) -> None:
        """Delegates physical schema wiping to the database adapter."""
        if hasattr(self._db, 'delete_schema'):
            await self._db.delete_schema(object_name)
        else:
            raise NotImplementedError("DatabaseAdapter does not support delete_schema.")
