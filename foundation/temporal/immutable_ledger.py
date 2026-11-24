from typing import List
from foundation.core.database_adapter import DatabaseAdapter
from foundation.core.temporal_types import LedgerEntry

class ImmutableLedgerStore:
    def __init__(self, db_adapter: DatabaseAdapter):
        self._db = db_adapter

    async def append_entry(self, entry: LedgerEntry) -> None:
        # Clean, typed, explicit interface call
        await self._db.insert_ledger_entry(entry, tx_id=entry.transaction_id)
        
        timestamp_str = entry.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
        print(f"[Ledger] {timestamp_str} | {entry.action} on {entry.object_name} ({entry.record_id})")

    async def get_record_history(self, tenant_id: str, record_id: str) -> List[LedgerEntry]:
        # Clean, typed, explicit interface call
        return await self._db.get_ledger_entries(tenant_id, record_id)
