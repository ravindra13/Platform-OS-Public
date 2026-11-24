from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from api.dependencies import services
from typing import Optional

router = APIRouter(prefix="/api/security", tags=["Security"])

class ShareRequest(BaseModel):
    object_name: str # <-- ADD THIS
    record_id: str
    target_user_id: str
    access_level: str = 'READ'

from fastapi import Header

@router.post("/share")
async def share_record_endpoint(
    request: ShareRequest,
    x_user_id: str = Header(..., description="The ID of the user attempting to share the record")
):
    """API endpoint to explicitly share a record with another user."""
    try:
        # ARCHITECTURE PURE: Route through the Core domain service to enforce guardrails!
        await services.security_core.grant_access(
            object_name=request.object_name, # <-- ADD THIS
            record_id=request.record_id,
            shared_with_id=request.target_user_id,
            access_level=request.access_level,
            actor_id=x_user_id
        )
        
        return {
            "status": "success",
            "message": f"Record {request.record_id} explicitly shared with {request.target_user_id}"
        }
    except PermissionError as e:
        # Catch the Zero-Trust rejection and return a 403 Forbidden
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from foundation.core.security_types import ObjectPermission

class ObjectPermissionRequest(BaseModel):
    profile_id: str
    object_name: str
    allow_create: bool = False
    allow_read: bool = False
    allow_update: bool = False
    allow_delete: bool = False


@router.post("/permissions/object")
async def update_object_permissions(req: ObjectPermissionRequest):
    """Admin endpoint to modify Object-Level Security for a specific profile."""
    # # 1. Fetch the existing profile
    profile = await services.sec_repo.get_profile(req.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile '{req.profile_id}' not found.")

    # # 2. Update the permissions for the specific object
    profile.object_permissions[req.object_name] = ObjectPermission(
        allow_create=req.allow_create,
        allow_read=req.allow_read,
        allow_update=req.allow_update,

        allow_delete=req.allow_delete
    )

    # # 3. Save the mutated profile back to the database
    await services.sec_repo.save_profile(profile)

    return {
        "status": "success",
        "message": f"Updated permissions for {req.object_name} on Profile {req.profile_id}"
    }


from pydantic import BaseModel
from foundation.core.security_types import FieldPermission

class FLSToggleRequest(BaseModel):
    profile_id: str
    object_name: str
    field_name: str
    allow_read: bool
    allow_update: bool


@router.post("/permissions/field")
async def update_field_security(
    req: FLSToggleRequest,
    x_execution_mode: str = Header("USER")
):
    """Allows SYSTEM mode to restrict field access for a specific profile."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can configure FLS.")

    try:
        # The router now simply delegates to the Core domain service!
        await services.security_core.update_field_permission(
            profile_id=req.profile_id,
            object_name=req.object_name,
            field_name=req.field_name,
            allow_read=req.allow_read,
            allow_update=req.allow_update
        )
        
        field_key = f"{req.object_name}.{req.field_name}"
        return {
            "status": "Success",
            "message": f"Updated FLS for {field_key} on profile {req.profile_id}."
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str):
    """Admin endpoint to fetch a profile's current permission matrix."""
    profile = await services.sec_repo.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    # Safely serialize the dataclass for the frontend
    return {
        "profile_id": profile.profile_id,
        "profile_name": profile.profile_name,
        "object_permissions": {
            obj: perm.__dict__ for obj, perm in profile.object_permissions.items()
        },
        "field_permissions": {
            field: perm.__dict__ for field, perm in profile.field_permissions.items()
        }
    }

from foundation.core.security_types import User, Profile

class CreateProfileRequest(BaseModel):
    profile_id: str
    profile_name: str

@router.post("/profiles")
async def create_profile(req: CreateProfileRequest):
    """Admin endpoint to stamp out a new empty profile."""
    # Creates a fresh profile with empty permission dictionaries
    new_profile = Profile(
        profile_id=req.profile_id,
        profile_name=req.profile_name
    )
    await services.sec_repo.save_profile(new_profile)
    return {"status": "success", "message": f"Profile '{req.profile_id}' created successfully."}

class CreateUserRequest(BaseModel):
    user_id: str
    profile_id: str
    tenant_id: str = "TENANT-ACME" # Defaulting for the platform for now

@router.post("/users")
async def create_user(req: CreateUserRequest):
    """Admin endpoint to onboard a new user and assign them a profile."""
    # Verify the profile actually exists first
    profile = await services.sec_repo.get_profile(req.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Cannot assign user: Profile '{req.profile_id}' does not exist.")

    new_user = User(
        user_id=req.user_id,
        name=req.user_id,
        profile_id=req.profile_id,
        tenant_id=req.tenant_id
    )
    await services.sec_repo.save_user(new_user)
    return {"status": "success", "message": f"User '{req.user_id}' provisioned for tenant '{req.tenant_id}'."}


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    profile_id: Optional[str] = None
    tenant_id: Optional[str] = None


@router.put("/users/{user_id}")
async def update_user(
    user_id: str, 
    req: UpdateUserRequest, 
    x_execution_mode: str = Header("USER")
):
    """Admin endpoint to modify an existing user."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can modify users.")

    # # 1. Fetch the existing user
    user = await services.sec_repo.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    # # 2. Mutate the attributes
    if req.name:
        user.name = req.name
    if req.tenant_id:
        user.tenant_id = req.tenant_id
    if req.profile_id:
        # Validate the new profile exists
        profile = await services.sec_repo.get_profile(req.profile_id)
        if not profile:
            raise HTTPException(status_code=400, detail="Target profile does not exist.")
        user.profile_id = req.profile_id

    # # 3. Upsert back to the database
    await services.sec_repo.save_user(user)
    return {"status": "success", "message": f"User '{user_id}' updated successfully."}


@router.get("/users")
async def list_users(x_execution_mode: str = Header("USER")):
    """Admin endpoint to list all users in the directory."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can list all users.")

    # NOTE: You must add this method to your PostgresSecurityMixin!
    users = await services.sec_repo.get_all_users()
    return {"users": [u.__dict__ for u in users]}


@router.delete("/share")
async def revoke_share_endpoint(
    record_id: str,
    target_user_id: str,
    x_user_id: str = Header(..., description="The ID of the user attempting to revoke access")
):
    """API endpoint to revoke explicit record sharing."""
    try:
        # Note: You will need to add a 'revoke_access' method to SecurityPolicyCore 
        # that verifies the actor has 'EDIT' rights before deleting the share from the repo.
        await services.security_core.revoke_access(
            record_id=record_id,
            shared_with_id=target_user_id,
            actor_id=x_user_id
        )
        
        return {
            "status": "success",
            "message": f"Access to record {record_id} revoked for {target_user_id}"
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str, 
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    """Admin endpoint to offboard a user from BOTH Identity and Metadata layers."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can delete users.")

    try:
        # 1. Remove the Security Identity (Login access revoked immediately)
        await services.sec_repo.delete_user(user_id)

        # 2. Prepare context for the pipeline
        req_context, _ = await services.req_manager.prepare_request(
            x_tenant_id, x_user_id, [], initial_mode="SYSTEM"
        )
        
        # 3. Remove the Metadata Record (Fires cascades, ledgers, and cleans erp_records)
        await services.action_pipeline.execute_delete("User", [user_id], req_context)

        return {"status": "success", "message": f"User '{user_id}' has been fully offboarded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/profiles/{profile_id}")
async def delete_profile(
    profile_id: str, 
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    """Admin endpoint to remove a profile from BOTH Identity and Metadata layers."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM mode can delete profiles.")

    try:
        # 1. Remove the Security Profile 
        await services.sec_repo.delete_profile(profile_id)

        # 2. Prepare context for the pipeline
        req_context, _ = await services.req_manager.prepare_request(
            x_tenant_id, x_user_id, [], initial_mode="SYSTEM"
        )
        
        # 3. Remove the Metadata Record 
        # (This will safely fail if RESTRICT dependencies exist on User records!)
        await services.action_pipeline.execute_delete("Profile", [profile_id], req_context)

        return {"status": "success", "message": f"Profile '{profile_id}' has been completely removed."}
    except ValueError as e:
        # Catch RESTRICT errors from the cascade engine (e.g. Users still attached to this profile)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))