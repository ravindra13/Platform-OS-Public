import json
from typing import Optional, List
from foundation.core.security_types import User, Profile, RecordShare
from foundation.core.security_types import ObjectPermission, FieldPermission

class PostgresSecurityMixin:
    """Mixin handling identity, profiles, and record-level sharing."""

    # --- Identity & Profiles ---

    async def save_user(self, user: User) -> None:
        user_dict = {"user_id": user.user_id, "name": user.name, "profile_id": user.profile_id, "tenant_id": user.tenant_id}
        query = """
            INSERT INTO erp_users (user_id, payload)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (user_id) DO UPDATE
            SET payload = EXCLUDED.payload;
        """
        async with self.pool.acquire() as conn:
            await conn.execute(query, user.user_id, json.dumps(user_dict))

    async def get_user(self, user_id: str) -> Optional[User]:
        query = "SELECT payload FROM erp_users WHERE user_id = $1;"
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, user_id)
        if row:
            data = json.loads(row["payload"])
            return User(user_id=data["user_id"], name=data["name"], profile_id=data["profile_id"], tenant_id=data["tenant_id"])
        return None

    async def save_profile(self, profile: Profile) -> None:
        # Assuming Profile has a dict() or similar serialization mechanism

        # Adjust serialization based on your exact Profile dataclass structure
        profile_dict = {
            "profile_id": profile.profile_id,
            "profile_name": profile.profile_name,
            "object_permissions": {k: v.__dict__ for k, v in profile.object_permissions.items()},
            "field_permissions": {k: v.__dict__ for k, v in profile.field_permissions.items()}
        }
        query = """
            INSERT INTO erp_profiles (profile_id, payload)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (profile_id) DO UPDATE
            SET payload = EXCLUDED.payload;
        """
        async with self.pool.acquire() as conn:
            await conn.execute(query, profile.profile_id, json.dumps(profile_dict))

    async def get_profile(self, profile_id: str) -> Optional[Profile]:
        query = "SELECT payload FROM erp_profiles WHERE profile_id = $1;"
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, profile_id)

        if row:
            data = json.loads(row["payload"])
            profile = Profile(profile_id=data["profile_id"], profile_name=data["profile_name"])
            # Rehydrate permissions (pseudo-code, adjust to your exact types)
            # Rehydrate Object Permissions
            profile.object_permissions = {
                k: ObjectPermission(**v) for k, v in data.get("object_permissions", {}).items()
            }

            # Rehydrate Field Permissions
            profile.field_permissions = {


                k: FieldPermission(**v) for k, v in data.get("field_permissions", {}).items()
            }
            return profile
        return None

    # --- Record-Level Security ---

    async def get_record_owner(self, record_id: str) -> Optional[str]:
        """Fetches the owner directly from the record payload."""
        query = "SELECT payload->>'OwnerId' as owner_id FROM erp_records WHERE id = $1 LIMIT 1;"
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, record_id)

    async def get_record_shares(self, record_id: str) -> List[RecordShare]:
        query = "SELECT record_id, user_id, access_level FROM record_shares WHERE record_id = $1;"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, record_id)
        return [RecordShare(record_id=r["record_id"], user_id=r["user_id"], access_level=r["access_level"]) for r in rows]

    async def add_record_share(self, record_id: str, user_id: str, access_level: str = 'READ') -> None:
        query = """
            INSERT INTO record_shares (record_id, user_id, access_level)
            VALUES ($1, $2, $3);
        """
        async with self.pool.acquire() as conn:
            await conn.execute(query, record_id, user_id, access_level)

    async def get_shared_record_ids(self, user_id: str) -> List[str]:
        query = "SELECT record_id FROM record_shares WHERE user_id = $1;"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, user_id)
        return [row["record_id"] for row in rows]

    async def get_all_users(self) -> List[User]:
        """Fetches all users from the directory."""
        query = "SELECT payload FROM erp_users;"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)

        users = []
        for row in rows:
            data = json.loads(row["payload"])
            users.append(
                User(
                    user_id=data["user_id"],
                    name=data["name"],
                    profile_id=data["profile_id"],
                    tenant_id=data.get("tenant_id", "TENANT-ACME")
                )
            )
        return users


    async def remove_record_share(self, record_id: str, user_id: str) -> None:
        """Removes explicit record-level sharing for a user."""
        query = "DELETE FROM record_shares WHERE record_id = $1 AND user_id = $2;"
        async with self.pool.acquire() as conn:
            await conn.execute(query, record_id, user_id)

    async def delete_user(self, user_id: str) -> None:
        """Removes the identity login from the security layer."""
        query = "DELETE FROM erp_users WHERE user_id = $1;"
        async with self.pool.acquire() as conn:
            await conn.execute(query, user_id)

    async def delete_profile(self, profile_id: str) -> None:
        """Removes the profile from the security layer."""
        query = "DELETE FROM erp_profiles WHERE profile_id = $1;"
        async with self.pool.acquire() as conn:
            await conn.execute(query, profile_id)