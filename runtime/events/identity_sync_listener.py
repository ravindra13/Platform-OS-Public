from foundation.core.security_types import User as SecurityUser, Profile as SecurityProfile
from runtime.events.event_bus import Event
import logging

class IdentitySyncListener:
    def __init__(self, sec_repo, db_adapter):
        self.sec_repo = sec_repo
        self.db_adapter = db_adapter

    async def handle_user_saved(self, event: Event):
        # We only care about User metadata changes
        if event.object_name != "User":
            return

        print(f"[Identity Sync] Intercepted User metadata save for Tenant {event.tenant_id}")

        # The payload contains SaveResult objects, so we extract the IDs
        for save_result in event.payload:
            if not save_result.success or not save_result.record_id:
                continue

            record_id = save_result.record_id

            # # 1. Fetch the latest metadata from the database
            metadata_record = await self.db_adapter.get_record_by_id(
                object_name="User",
                record_id=record_id,
                tenant_id=event.tenant_id
            )

            if not metadata_record:
                continue
            # # 2. Extract business data to build the security identity
            profile_id = metadata_record.get("ProfileId", "PROF-STANDARD")
            name = metadata_record.get("Name", record_id)

            # # 3. Check if the security identity already exists
            existing_sec_user = await self.sec_repo.get_user(record_id)

            if existing_sec_user:
                # # Update existing identity (e.g., if ProfileId changed)
                existing_sec_user.name = name
                existing_sec_user.profile_id = profile_id
                await self.sec_repo.save_user(existing_sec_user)
                print(f"[Identity Sync] Updated security identity for {record_id}")
            else:
                # # Provision brand new identity
                new_sec_user = SecurityUser(
                    user_id=record_id,
                    name=name,
                    profile_id=profile_id,
                    tenant_id=event.tenant_id
                )
                await self.sec_repo.save_user(new_sec_user)
                print(f"[Identity Sync] Provisioned new security identity for {record_id}")

    async def handle_profile_saved(self, event: Event):
        # # We only care about Profile metadata changes
        if event.object_name != "Profile":
            return

        print(f"[Identity Sync] Intercepted Profile metadata save for Tenant {event.tenant_id}")
        for save_result in event.payload:
            if not save_result.success or not save_result.record_id:
                continue

            record_id = save_result.record_id

            # # Fetch metadata
            metadata_record = await self.db_adapter.get_record_by_id(
                object_name="Profile", record_id=record_id, tenant_id=event.tenant_id
            )
            if not metadata_record:
                continue

            name = metadata_record.get("Name", record_id)

            # # Check if profile already exists in Security layer
            existing_sec_profile = await self.sec_repo.get_profile(record_id)

            if existing_sec_profile:
                # # Update existing profile name
                existing_sec_profile.profile_name = name
                await self.sec_repo.save_profile(existing_sec_profile)
                print(f"[Identity Sync] Updated security profile: {record_id}")
            else:
                # # Provision new profile with default restrictive permissions
                new_sec_profile = SecurityProfile(
                    profile_id=record_id,
                    profile_name=name,
                    object_permissions={},
                    field_permissions={}
                )
                await self.sec_repo.save_profile(new_sec_profile)
                print(f"[Identity Sync] Provisioned new security profile: {record_id}")
                print(f"[Identity Sync] Provisioned new security profile: {record_id}")
