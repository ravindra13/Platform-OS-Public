# seeders/seeder.py

import os
from foundation.core.security_types import Profile, User, ObjectPermission
from foundation.core.schema_types import FieldDefinition, FieldType, ReferenceConfig, RelationshipType, DeletionBehavior
from foundation.core.sovereignty_types import DataRegion

# Import your industry-specific seeder
# from scripts.seeder_hospital_safe import seed_hms_metadata
# from scripts.seeder_procurement_safe import seed_procurement_metadata


async def seed_initial_metadata(services) -> None:
    print("[Seeder] Bootstrapping core platform foundation...")

    # Fetch the URL from the environment variable
    db_url = os.environ.get("POSTGRES_DSN", "postgresql://postgres:1234@localhost:5432/my_erp_db")

    # # 3. ONBOARD TENANT ONLY IF MISSING
    services.sovereignty_router.onboard_tenant(
        tenant_id="TENANT-ACME",
        region=DataRegion.EU_CENTRAL,
        connection_string=db_url,
        read_replica_url=db_url
    )

    # ---> ADDED NEW BLOCK FOR GLOBEX <---
    services.sovereignty_router.onboard_tenant(
        tenant_id="TENANT-GLOBEX",
        region=DataRegion.EU_CENTRAL,
        connection_string=db_url,
        read_replica_url=db_url
    )

    # # 1. CHECK IF FOUNDATION ALREADY EXISTS
    existing_profile = await services.sec_repo.get_profile('PROF-ADMIN')

    if not existing_profile:
        print("[Seeder] First run detected. Seeding Admin Profile and User...")

        # --- SECURITY CONTEXT SEEDING ---
        admin_profile = Profile(
            profile_id='PROF-ADMIN',
            profile_name='System Administrator',
            object_permissions={
            "User": ObjectPermission(allow_create=True, allow_read=True, allow_update=True, allow_delete=True),
            "Profile": ObjectPermission(allow_create=True, allow_read=True, allow_update=True, allow_delete=True)
            },
            field_permissions={}
        )
        await services.sec_repo.save_profile(admin_profile)

        await services.sec_repo.save_user(User(
            user_id='USER-ALICE', name='Alice', profile_id='PROF-ADMIN', tenant_id='TENANT-ACME'
        ))

        standard_profile = Profile(
            profile_id='PROF-STANDARD',
            profile_name='Standard User',
            object_permissions={
                "User": ObjectPermission(allow_create=False, allow_read=True, allow_update=False, allow_delete=False),
                "Profile": ObjectPermission(allow_create=False, allow_read=True, allow_update=False, allow_delete=False)
            },
            field_permissions={}
        )
        await services.sec_repo.save_profile(standard_profile)

        await services.sec_repo.save_user(User(
            user_id='USER-BOB', name='Bob', profile_id='PROF-STANDARD', tenant_id='TENANT-ACME'
        ))

        # --- METADATA CONTEXT SEEDING ---

        # # 1. Create the Profile Metadata Object (Globally Readable, No Owner)
        profile_schema = await services.schema_engine.create_object('Profile', 'Security Profile', enable_rls=False, has_owner=False)
        await services.schema_engine.add_field('Profile', FieldDefinition(field_name='Name', data_type=FieldType.STRING, required=True))

        # ARCHITECTURE FIX: Define Profile UI View Mappings using update_system_layout
        await services.schema_engine.update_system_layout('Profile', 'list', {
            "columns": ["Id", "Name"]
        })

        # # 2. Create the User Metadata Object (Globally Readable, No Owner)
        user_schema = await services.schema_engine.create_object('User', 'System User', enable_rls=False, has_owner=False)
        await services.schema_engine.add_field('User', FieldDefinition(field_name='Name', data_type=FieldType.STRING, required=True))

        # # ARCHITECTURE FIX: ProfileId is now a true Reference field!
        await services.schema_engine.add_field('User', FieldDefinition(
            field_name='ProfileId',
            data_type=FieldType.REFERENCE,
            config=ReferenceConfig(
                target_object='Profile',
                relationship_type=RelationshipType.LOOKUP,
                deletion_behavior=DeletionBehavior.RESTRICT
            ),
            required=True
        ))

        # ARCHITECTURE FIX: Define User UI View Mappings using update_system_layout
        await services.schema_engine.update_system_layout('User', 'list', {
            "columns": ["Id", "Name", "ProfileId"]
        })

        # # Prepare a SYSTEM-level request context using your standard manager
        req_context, _ = await services.req_manager.prepare_request(
            tenant_id="TENANT-ACME",
            user_id="USER-ALICE",
            payloads=[],
            initial_mode="SYSTEM"
        )

        # --- SEED PROFILES VIA PIPELINE ---
        print("[Seeder] Pushing Profile records through the Action Pipeline...")
        profile_results = await services.action_pipeline.execute_save(
            object_name="Profile",
            payloads=[
                {"Id": "PROF-ADMIN", "Name": "System Administrator"},
                {"Id": "PROF-STANDARD", "Name": "Standard User"}
            ],
            context=req_context
        )
        for r in profile_results:
            if not r.success:
                print(f"[Seeder ERROR] Failed to insert Profile: {r.errors}")

        # --- SEED USERS VIA PIPELINE ---
        print("[Seeder] Pushing User records through the Action Pipeline...")

        # # ARCHITECTURE FIX: Single Pass Insertion!
        # # Because has_owner=False, the pipeline skips OwnerId injection, avoiding the FK Paradox.
        user_results = await services.action_pipeline.execute_save(
            object_name="User",
            payloads=[
                {"Id": "USER-ALICE", "Name": "Alice", "ProfileId": "PROF-ADMIN"},
                {"Id": "USER-BOB", "Name": "Bob", "ProfileId": "PROF-STANDARD"}
            ],
            context=req_context
        )

        for r in user_results:
            if not r.success:
                print(f"[Seeder ERROR] Failed to insert User: {r.errors}")

        print("[Seeder] Physical User and Profile records created successfully.")
        print("[Seeder] Platform OS foundation initialized successfully.")
    else:
        print("[Seeder] Foundation already exists. Bypassing seed to preserve data.")

    # # --- SEED GLOBEX USERS IF MISSING ---
    globex_admin = await services.sec_repo.get_user('USER-GLOBEX-ADMIN')
    
    if not globex_admin:
        print("[Seeder] Seeding Globex Admin User and Profile...")
        
        # 1. Save the physical user record to the security repository
        await services.sec_repo.save_user(User(
            user_id='USER-GLOBEX-ADMIN', 
            name='Globex Admin', 
            profile_id='PROF-ADMIN', 
            tenant_id='TENANT-GLOBEX'
        ))

        # 2. Prepare a SYSTEM-level request context specifically for Globex
        globex_req_context, _ = await services.req_manager.prepare_request(
            tenant_id="TENANT-GLOBEX",
            user_id="USER-GLOBEX-ADMIN",
            payloads=[],
            initial_mode="SYSTEM"
        )

        # 3. Push the Profile record into the Globex tenant partition first
        print("[Seeder] Pushing Globex Profile record through the Action Pipeline...")
        await services.action_pipeline.execute_save(
            object_name="Profile",
            payloads=[
                {"Id": "PROF-ADMIN", "Name": "System Administrator"}
            ],
            context=globex_req_context
        )

        # 4. Push the User record through the Action Pipeline
        print("[Seeder] Pushing Globex User record through the Action Pipeline...")
        globex_user_results = await services.action_pipeline.execute_save(
            object_name="User",
            payloads=[
                {"Id": "USER-GLOBEX-ADMIN", "Name": "Globex Admin", "ProfileId": "PROF-ADMIN"}
            ],
            context=globex_req_context
        )
        
        for r in globex_user_results:
            if not r.success:
                print(f"[Seeder ERROR] Failed to insert Globex User: {r.errors}")