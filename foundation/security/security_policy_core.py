from typing import Literal
from foundation.core.security_types import CrudAction, AccessLevel
from foundation.security.security_repository import SecurityRepository
from foundation.core.security_types import FieldPermission

class SecurityPolicyCore:
    def __init__(self, repo: SecurityRepository):
        self.repo = repo

    async def has_object_access(self, user_id: str, object_name: str, action: CrudAction) -> bool:
        """
        1. OBJECT-LEVEL SECURITY (CRUD)
        Can this user create/read/update/delete this type of object?
        """
        user = await self.repo.get_user(user_id)
        if not user:
            raise ValueError(f"User '{user_id}' not found.")

        profile = await self.repo.get_profile(user.profile_id)
        if not profile:
            raise ValueError(f"Profile '{user.profile_id}' not found.")

        obj_perms = profile.object_permissions.get(object_name)
        if not obj_perms:
            return False # Zero-trust default

        if action == 'CREATE': return obj_perms.allow_create
        if action == 'READ': return obj_perms.allow_read
        if action == 'UPDATE': return obj_perms.allow_update
        if action == 'DELETE': return obj_perms.allow_delete
    async def has_field_access(self, user_id: str, object_name: str, field_name: str, action: Literal['READ', 'UPDATE']) -> bool:
        """
        2. FIELD-LEVEL SECURITY (FLS)
        Can this user see or edit this specific field on the object?
        """
        user = await self.repo.get_user(user_id)
        if not user:
            return False

        profile = await self.repo.get_profile(user.profile_id)
        if not profile:
            return False

        field_key = f"{object_name}.{field_name}"
        field_perms = profile.field_permissions.get(field_key)

        # If no explicit field restriction exists, fall back to open if object access is granted
        if not field_perms:
            return True

        return field_perms.allow_read if action == 'READ' else field_perms.allow_update

    # Add this inside the SecurityPolicyCore class
    async def update_field_permission(self, profile_id: str, object_name: str, field_name: str, allow_read: bool, allow_update: bool) -> None:
        """
        ADMIN: Updates Field-Level Security for a specific profile.
        """
        profile = await self.repo.get_profile(profile_id)
        if not profile:
            raise ValueError(f"Profile '{profile_id}' not found.")

        field_key = f"{object_name}.{field_name}"
        profile.field_permissions[field_key] = FieldPermission(
            allow_read=allow_read,
            allow_update=allow_update
        )

        await self.repo.save_profile(profile)

    async def has_object_override(self, user_id: str, object_name: str, required_access: str) -> bool:
        """O(1) Check for View All / Modify All bypass."""
        user = await self.repo.get_user(user_id)
        profile = await self.repo.get_profile(user.profile_id)
        obj_perms = profile.object_permissions.get(object_name)

        if not obj_perms:
            return False

        if required_access in ('READ', 'VIEW'):
            return obj_perms.allow_view_all or obj_perms.allow_modify_all
        if required_access in ('EDIT', 'TRANSFER', 'DELETE'):
            return obj_perms.allow_modify_all

        return False

    async def has_record_access(self, user_id: str, object_name: str, record_id: str, required_access: str) -> bool:
        """
        3. RECORD-LEVEL SECURITY (Sharing, Ownership & Transfer)
        Can this user view, edit, or transfer this specific record?
        """

        # # 0. THE O(1) PERFORMANCE BYPASS
        if await self.has_object_override(user_id, object_name, required_access):
            return True

        # Fetch the owner ID (This is a string, not a dictionary!)
        owner_id = await self.repo.get_record_owner(record_id)

        # # 1. EVALUATE TRANSFER RIGHTS (Ownership Guardrail)
        if required_access == 'TRANSFER':
            # The current owner can always transfer their own record
            if owner_id == user_id:
                return True

            # System Administrators can transfer anyone's record
            user = await self.repo.get_user(user_id)
            if user and user.profile_id == 'PROF-ADMIN':
                return True

            return False

        # # 2. EVALUATE STANDARD READ/EDIT RIGHTS
        # # Record Owner gets full access automatically
        if owner_id == user_id:
            return True

        # Check explicit record sharing rules
        shares = await self.repo.get_record_shares(record_id)
        user_share = next((s for s in shares if s.user_id == user_id), None)

        if user_share:
            if required_access == 'READ':
                return user_share.access_level in ('READ', 'EDIT', 'ALL')
            if required_access == 'EDIT':
                return user_share.access_level in ('EDIT', 'ALL')

        # Fallback: Zero-trust default
        return False

    async def grant_access(
        self, object_name: str, record_id: str, shared_with_id: str, access_level: str, actor_id: str
    ) -> None:
        """
        NATIVE SHARING ENGINE: Grants access to a record after enforcing Zero-Trust security.
        """
        # # 1. SECURITY INHERITANCE: Actor must have EDIT rights to share a record
        has_access = await self.has_record_access(actor_id, object_name, record_id, 'EDIT')
        if not has_access:
            raise PermissionError(f"User '{actor_id}' lacks access to share record '{record_id}'")

        # # 2. Delegate to the repository (which uses the fast SQL table)
        await self.repo.share_record(
            record_id=record_id,
            user_id=shared_with_id,
            access_level=access_level
        )


    async def revoke_access(
        self, record_id: str, shared_with_id: str, actor_id: str
    ) -> None:
        """
        NATIVE SHARING ENGINE: Revokes access to a record after enforcing Zero-Trust security.
        """
        # 1. SECURITY INHERITANCE: Actor must have EDIT rights to modify sharing rules
        has_access = await self.has_record_access(actor_id, "ANY", record_id, 'EDIT')
        if not has_access:
            raise PermissionError(f"User '{actor_id}' lacks access to revoke sharing for record '{record_id}'")

        # 2. Delegate to the repository to delete the share
        # Note: You need to implement remove_record_share in your repo!
        await self.repo.remove_record_share(
            record_id=record_id,
            user_id=shared_with_id
        )