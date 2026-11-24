from typing import Dict, List, Optional
from foundation.core.database_adapter import DatabaseAdapter
from foundation.core.security_types import User, Profile, RecordShare

class SecurityRepository:
    """
    Bridge layer for identity, profile, and record-level sharing.
    Delegates database operations to DatabaseAdapter.
    """

    def __init__(self, db_adapter: DatabaseAdapter):
        self._db = db_adapter
        # Removed the _users and _profiles dictionaries to eliminate ephemeral state

    async def save_user(self, user: User) -> None:
        await self._db.save_user(user)

    async def get_user(self, user_id: str) -> Optional[User]:
        return await self._db.get_user(user_id)

    async def save_profile(self, profile: Profile) -> None:
        await self._db.save_profile(profile)

    async def get_profile(self, profile_id: str) -> Optional[Profile]:
        return await self._db.get_profile(profile_id)

    async def share_record(self, record_id: str, user_id: str, access_level: str = 'READ') -> None:
        """Persists a new record share safely in the database."""
        await self._db.add_record_share(record_id, user_id, access_level)

    async def get_user_shared_records(self, user_id: str) -> List[str]:
        """Safely delegates sharing lookups to the database adapter."""
        # Note: Ensure your DatabaseAdapter interface includes this method signature!
        return await self._db.get_shared_record_ids(user_id)

    async def get_record_owner(self, record_id: str) -> Optional[str]:
        return await self._db.get_record_owner(record_id)

    async def get_record_shares(self, record_id: str) -> List[RecordShare]:
        return await self._db.get_record_shares(record_id)

    async def get_all_users(self) -> List[User]:
        return await self._db.get_all_users()

    async def remove_record_share(self, record_id: str, user_id: str) -> None:
        """Removes a record share from the database."""
        await self._db.remove_record_share(record_id, user_id)