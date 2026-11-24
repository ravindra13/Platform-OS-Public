from runtime.context.context_models import RequestContext
from foundation.security.security_policy_core import SecurityPolicyCore
from foundation.temporal.immutable_ledger import ImmutableLedgerStore

class AuditCapabilityService:
    def __init__(self, security_core: SecurityPolicyCore, ledger_store: ImmutableLedgerStore, schema_engine): 
        self.security_core = security_core
        self.ledger_store = ledger_store
        self.schema_engine = schema_engine # <-- SAVE TO INSTANCE

    async def get_record_history(
        self,
        object_name: str,
        record_id: str,
        context: RequestContext
    ) -> list:

        if context.mode == 'USER':
            # 1. FAST PATH SECURITY: Object-Level Access
            has_obj_access = await self.security_core.has_object_access(
                context.user.user_id, object_name, 'READ'
            )
            if not has_obj_access:
                raise PermissionError(f"User lacks READ access to object '{object_name}'")

            # 2. FETCH METADATA SCHEMA
            schema = await self.schema_engine.get_object_blueprint(object_name)
            
            # 3. ONLY ENFORCE RLS IF CONFIGURED (e.g., skips for 'User' object)
            if schema and getattr(schema, 'enable_rls', True):
                has_rec_access = await self.security_core.has_record_access(
                    context.user.user_id, object_name, record_id, 'READ'
                )
                if not has_rec_access:
                    raise PermissionError(f"User lacks access to audit history for record '{record_id}'")

        # 4. Fetch History
        # return await self.ledger_store.get_history(...)

        # 4. Fetch History (UNCOMMENTED AND FIXED)
        return await self.ledger_store.get_record_history(
            tenant_id=context.user.tenant_id,
            record_id=record_id
        )