import uuid
from typing import Dict, Any, Optional
from foundation.core.database_adapter import DatabaseAdapter
from foundation.core.temporal_types import LedgerEntry, AuditDelta
from foundation.temporal.immutable_ledger import ImmutableLedgerStore
from foundation.sovereignty.tenant_router import SovereigntyRouter

class DatabaseTransactionManager:
    """
    Coordinates multi-region database operations, state calculation,
    and append-only ledger entries within a transactional boundary.
    """

    def __init__(
        self,
        ledger_store: ImmutableLedgerStore,
        router: SovereigntyRouter,
        db_adapter: DatabaseAdapter
    ):
        self.ledger = ledger_store
        self.router = router
        self.db_adapter = db_adapter

    async def begin_transaction(self, tenant_id: str) -> str:
        db_url = self.router.get_primary_connection(tenant_id)

        tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
        print(f"\n[DB Transaction] --- TRANSACTION {tx_id} STARTED ---")

        # Command the adapter to lock a physical connection for this ID
        await self.db_adapter.begin_transaction(tx_id)
        return tx_id
    async def commit(self, tx_id: str) -> None:
        await self.db_adapter.commit_transaction(tx_id)
        print(f"[DB Transaction] --- TRANSACTION {tx_id} COMMITTED SUCCESSFULLY ---\n")

    async def rollback(self, tx_id: str, reason: str) -> None:
        await self.db_adapter.rollback_transaction(tx_id)
        print(f"[DB Transaction] --- TRANSACTION {tx_id} ROLLED BACK! Reason: {reason} ---\n")

    async def physical_save(
        self,
        tx_id: str,
        tenant_id: str,
        actor_id: str,
        object_name: str,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        record_id = payload.get('Id')
        if not record_id:
            raise ValueError("Cannot save record without an 'Id'.")

        # # 1. Fetch current state to calculate deltas
        existing_record = await self.db_adapter.get_record_by_id(object_name, record_id, tenant_id, tx_id=tx_id)
        old_state = existing_record or {}
        action = "UPDATE" if existing_record else "CREATE"

        # # 2. Calculate Deltas
        deltas = []
        for field_name, new_value in payload.items():
            old_value = old_state.get(field_name)
            if old_value != new_value:
                deltas.append(AuditDelta(field_name=field_name, old_value=old_value, new_value=new_value))
        # # 3. Create Audit Ledger Entry
        if deltas or action == "CREATE":
            entry = LedgerEntry(
                transaction_id=tx_id,
                tenant_id=tenant_id,
                object_name=object_name,
                record_id=record_id,
                actor_id=actor_id,
                action=action,
                deltas=deltas
            )
            await self.ledger.append_entry(entry)

        # # 4. Perform database write
        if existing_record:
            saved = await self.db_adapter.update_record(object_name, record_id, payload, tenant_id, tx_id=tx_id)
        else:
            saved = await self.db_adapter.insert_record(object_name, payload, tenant_id, tx_id=tx_id)

        print(f"[DB Write] Saved {object_name} '{record_id}' for Tenant '{tenant_id}'")
        return saved

    async def physical_delete(
        self,
        tx_id: str,
        tenant_id: str,
        actor_id: str,
        object_name: str,
        record_id: str
    ) -> bool:
        existing_record = await self.db_adapter.get_record_by_id(object_name, record_id, tenant_id, tx_id=tx_id)
        if not existing_record:
            raise ValueError(f"Record '{record_id}' does not exist.")

        entry = LedgerEntry(
            transaction_id=tx_id,
            tenant_id=tenant_id,
            object_name=object_name,
            record_id=record_id,
            actor_id=actor_id,
            action="HARD_DELETE"
        )
        await self.ledger.append_entry(entry)

        return await self.db_adapter.delete_record(object_name, record_id, tenant_id, tx_id=tx_id)


    async def lookup_by_external_id(self, object_name: str, field_name: str, value: str, tenant_id: str, tx_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        # Delegates to the Postgres adapter method we just built
        return await self.db_adapter.get_record_by_external_id(object_name, field_name, value, tenant_id, tx_id)
