import sys
from pathlib import Path

# # Ensure project root is in python path when running directly
sys.path.append(str(Path(__file__).resolve().parent.parent))

from typing import Any, Dict, List, Optional
from foundation.core.database_adapter import DatabaseAdapter
from foundation.core.schema_types import ObjectDefinition

class InMemoryDatabaseAdapter(DatabaseAdapter):
    """
    In-memory database driver implementation.
    Supports tenant isolation, schema persistence, dynamic record CRUD,
    and dictionary-based filter querying for runtime engine execution.
    """

    def __init__(self):
        self._schemas: Dict[str, ObjectDefinition] = {}
        # # Stores records partitioned by tenant_id:object_name
        self._records: Dict[str, List[Dict[str, Any]]] = {}

    # # --- Schema Operations ---
    async def save_schema(self, schema: ObjectDefinition) -> None:
        self._schemas[schema.object_name] = schema
        print(f"[InMemory DB] Saved schema for '{schema.object_name}'")

    async def get_schema(self, object_name: str) -> Optional[ObjectDefinition]:
        return self._schemas.get(object_name)

    # # --- Record CRUD Operations ---
    async def insert_record(self, object_name: str, payload: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
        key = f"{tenant_id}:{object_name}"
        if key not in self._records:
            self._records[key] = []

        # # Store a shallow copy to prevent external mutation leaks
        record_copy = dict(payload)
        self._records[key].append(record_copy)
        print(f"[InMemory DB] Inserted record '{record_copy.get('Id')}' into '{object_name}' for tenant '{tenant_id}'")
        return record_copy

    async def get_record_by_id(self, object_name: str, record_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Helper for fetching a single record by primary key."""
        key = f"{tenant_id}:{object_name}"
        records = self._records.get(key, [])
        for record in records:
            if record.get('Id') == record_id:
                return dict(record)
        return None

    async def update_record(self, object_name: str, record_id: str, payload: Dict[str, Any], tenant_id: str) -> Optional[Dict[str, Any]]:
        """Updates fields on an existing record for a given tenant."""
        key = f"{tenant_id}:{object_name}"
        records = self._records.get(key, [])
        for record in records:
            if record.get('Id') == record_id:
                record.update(payload)
                print(f"[InMemory DB] Updated record '{record_id}' in '{object_name}' for tenant '{tenant_id}'")
                return dict(record)
        return None

    async def query_records(self, object_name: str, filters: Dict[str, Any], tenant_id: str) -> List[Dict[str, Any]]:
        """
        Queries records matching the provided filter dict.
        An empty filter dict returns all records for the tenant/object.
        """
        key = f"{tenant_id}:{object_name}"
        all_records = self._records.get(key, [])

        if not filters:
            return [dict(r) for r in all_records]

        matching_records = []
        for record in all_records:
            # Check if record matches all key-value filter conditions
            matches = all(record.get(k) == v for k, v in filters.items())
            if matches:
                matching_records.append(dict(record))

        return matching_records

    async def delete_record(self, object_name: str, record_id: str, tenant_id: str) -> bool:
        key = f"{tenant_id}:{object_name}"
        if key in self._records:
            initial_count = len(self._records[key])
            self._records[key] = [r for r in self._records[key] if r.get('Id') != record_id]
            deleted = len(self._records[key]) < initial_count
            if deleted:
                print(f"[InMemory DB] Deleted record '{record_id}' from '{object_name}' for tenant '{tenant_id}'")
                return deleted
        return False
