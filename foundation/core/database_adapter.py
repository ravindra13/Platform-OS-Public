from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from foundation.core.schema_types import ObjectDefinition
# Add the security imports
from foundation.core.security_types import User, Profile, RecordShare
from foundation.core.temporal_types import LedgerEntry

class DatabaseAdapter(ABC):
    """
    Abstract Base Class defining the contract for all database storage engines.
    Engine layers depend on this interface, enabling database pluggability.
    """

    # --- Schema Persistence ---
    @abstractmethod
    async def save_schema(self, schema: ObjectDefinition) -> None:
        """Persists an object definition schema to storage."""
        pass

    @abstractmethod
    async def get_schema(self, object_name: str) -> Optional[ObjectDefinition]:
        """Fetches an object definition schema by name."""
        pass

    # --- Record Operations (For Runtime Engine) ---
    @abstractmethod
    async def insert_record(self, object_name: str, payload: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
        """Inserts a validated record payload into target storage."""
        pass

    @abstractmethod
    async def query_records(self, object_name: str, filters: Dict[str, Any], tenant_id: str) -> List[Dict[str, Any]]:
        """Executes a query against target storage filtered by tenant."""
        pass

    @abstractmethod
    async def delete_record(self, object_name: str, record_id: str, tenant_id: str) -> bool:
        """Deletes a record from target storage."""
        pass

    # --- Security & Identity Operations ---
    @abstractmethod
    async def save_user(self, user: 'User') -> None:
        """Persists a user to storage."""
        pass

    @abstractmethod
    async def get_user(self, user_id: str) -> Optional['User']:
        """Fetches a user by their ID."""
        pass

    @abstractmethod
    async def save_profile(self, profile: 'Profile') -> None:
        """Persists a security profile to storage."""
        pass

    @abstractmethod
    async def get_profile(self, profile_id: str) -> Optional['Profile']:
        """Fetches a security profile by its ID."""
        pass

    # --- Record-Level Security (Sharing & Ownership) ---
    @abstractmethod
    async def get_record_owner(self, record_id: str) -> Optional[str]:
        """Returns the user_id of the record owner."""
        pass

    @abstractmethod
    async def get_record_shares(self, record_id: str) -> List['RecordShare']:
        """Returns all explicit sharing rules for a specific record."""
        pass

    @abstractmethod
    async def add_record_share(self, record_id: str, user_id: str, access_level: str) -> None:
        """Persists a new record share safely in the database."""
        pass

    @abstractmethod
    async def get_shared_record_ids(self, user_id: str) -> List[str]:
        """Returns a list of record IDs explicitly shared with the user."""
        pass

    @abstractmethod
    async def get_all_users(self) -> List['User']:
        """Fetches all registered users from storage."""
        pass

    @abstractmethod
    async def insert_ledger_entry(self, entry: LedgerEntry, tx_id: Optional[str] = None) -> None:
        """Persists an audit ledger entry."""
        pass

    @abstractmethod
    async def get_ledger_entries(self, tenant_id: str, record_id: str, tx_id: Optional[str] = None) -> List[LedgerEntry]:
        """Retrieves audit history for a specific record."""
        pass

    @abstractmethod
    async def delete_schema(self, object_name: str) -> None:
        """
        Physically deletes the object definition schema from storage 
        AND drops the associated underlying data tables/collections to prevent ghost data.
        """
        pass