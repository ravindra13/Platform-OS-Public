from foundation.security.security_repository import SecurityRepository
from runtime.context.context_models import UserContext

class ContextHydrator:
    """
    Hydrates user permissions and identity into active memory from the Security Repository.
    """
    
    def __init__(self, security_repo: SecurityRepository):
        self.security_repo = security_repo
        
    async def hydrate(self, tenant_id: str, user_id: str) -> UserContext:
        print(f"[Context Hydrator] Loading session for User '{user_id}' in Tenant '{tenant_id}'...")
        
        user = await self.security_repo.get_user(user_id)
        if not user:
            raise ValueError(f"User '{user_id}' not found in Security Repository.")
            
        profile = await self.security_repo.get_profile(user.profile_id)
        if not profile:
            raise ValueError(f"Profile '{user.profile_id}' not found in Security Repository.")
            
        user_context = UserContext(
            tenant_id=tenant_id,
            user_id=user_id,
            profile_id=user.profile_id,
            cached_object_perms=profile.object_permissions,
            cached_field_perms=profile.field_permissions
        )
        
        print(f"[Context Hydrator] Successfully cached Profile '{user.profile_id}' permissions in memory.")
        return user_context
