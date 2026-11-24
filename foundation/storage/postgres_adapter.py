import asyncpg
from foundation.core.database_adapter import DatabaseAdapter

# # Import the new mixins
from foundation.storage.postgres_schema import PostgresSchemaMixin
from foundation.storage.postgres_records import PostgresRecordsMixin
from foundation.storage.postgres_security import PostgresSecurityMixin

class PostgresDatabaseAdapter(
    PostgresSchemaMixin,
    PostgresRecordsMixin,
    PostgresSecurityMixin,
    DatabaseAdapter
):
    """
    PostgreSQL concrete driver combined via mixins.
    """

    def __init__(self, connection_pool: asyncpg.Pool):
        self.pool = connection_pool
        # # NEW: Infrastructure-level mapping of tx_id to active connections
        self.active_transactions = {}

    @classmethod
    async def create_adapter(cls, dsn: str) -> "PostgresDatabaseAdapter":
        pool = await asyncpg.create_pool(dsn=dsn, min_size=2, max_size=10)
        adapter = cls(connection_pool=pool)
        await adapter._init_tables()
        return adapter

    async def _init_tables(self) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute("""
                -- Existing Tables
                CREATE TABLE IF NOT EXISTS erp_schemas (
                    object_name VARCHAR(128) PRIMARY KEY,
                    schema_json JSONB NOT NULL
                );

                CREATE TABLE IF NOT EXISTS erp_records (
                    id VARCHAR(128) NOT NULL,
                    object_name VARCHAR(128) NOT NULL,
                    tenant_id VARCHAR(128) NOT NULL,
                    payload JSONB NOT NULL,
                    PRIMARY KEY (tenant_id, object_name, id)
                );

                CREATE INDEX IF NOT EXISTS idx_erp_records_lookup
                ON erp_records (tenant_id, object_name);

                CREATE TABLE IF NOT EXISTS erp_counters (
                    object_name VARCHAR(128) PRIMARY KEY,
                    current_value BIGINT NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS record_shares (
                    id SERIAL PRIMARY KEY,
                    record_id VARCHAR(128) NOT NULL,
                    user_id VARCHAR(128) NOT NULL,
                    access_level VARCHAR(50) DEFAULT 'READ',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_record_shares_user_id
                ON record_shares (user_id);

                -- NEW: Identity & Profile Tables
                CREATE TABLE IF NOT EXISTS erp_users (
                    user_id VARCHAR(128) PRIMARY KEY,
                    payload JSONB NOT NULL
                );

                CREATE TABLE IF NOT EXISTS erp_profiles (
                    profile_id VARCHAR(128) PRIMARY KEY,
                    payload JSONB NOT NULL
                );

                -- NEW: Audit Ledger Table
                CREATE TABLE IF NOT EXISTS erp_audit_ledger (
                    id SERIAL PRIMARY KEY,
                    tenant_id VARCHAR(128) NOT NULL,
                    transaction_id VARCHAR(128),
                    object_name VARCHAR(128) NOT NULL,
                    record_id VARCHAR(128) NOT NULL,
                    actor_id VARCHAR(128) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    deltas JSONB
                );

                CREATE INDEX IF NOT EXISTS idx_erp_audit_lookup
                ON erp_audit_ledger (tenant_id, record_id);
            """)
    async def close(self) -> None:
        await self.pool.close()

    async def begin_transaction(self, tx_id: str) -> None:
        conn = await self.pool.acquire()
        await conn.execute("BEGIN;")
        self.active_transactions[tx_id] = conn

    async def commit_transaction(self, tx_id: str) -> None:
        conn = self.active_transactions.pop(tx_id, None)
        if conn:
            try:
                await conn.execute("COMMIT;")
            finally:
                await self.pool.release(conn)
        # # await conn.execute("COMMIT;")
        # # await self.pool.release(conn)

    async def rollback_transaction(self, tx_id: str) -> None:
        conn = self.active_transactions.pop(tx_id, None)
        if conn:
            try:
                await conn.execute("ROLLBACK;")
            finally:
                await self.pool.release(conn)
        # # await conn.execute("ROLLBACK;")
        # # await self.pool.release(conn)
