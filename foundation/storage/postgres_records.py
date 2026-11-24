import json
from typing import Any, Dict, List, Optional
from foundation.storage.sql_compiler import PostgresJsonbCompiler
from foundation.core.query_types import AbstractQuery
from foundation.core.temporal_types import LedgerEntry

class PostgresRecordsMixin:
    """Mixin handling CRUD operations and queries for ERP records."""

    # --- SEQUENCE GENERATOR ---

    async def get_next_sequence(self, object_name: str, tx_id: Optional[str] = None) -> int:
        """
        Atomically increments and returns the next sequence number for an object.
        Creates the counter starting at 1 if it doesn't exist.
        """
        query = """
            INSERT INTO erp_counters (object_name, current_value)
            VALUES ($1, 1)
            ON CONFLICT (object_name) DO UPDATE
            SET current_value = erp_counters.current_value + 1
            RETURNING current_value;
        """

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            sequence_val = await conn.fetchval(query, object_name)
        else:
            async with self.pool.acquire() as c:
                sequence_val = await c.fetchval(query, object_name)

        return sequence_val
    # --- RECORD CRUD OPERATIONS ---

    async def insert_record(self, object_name: str, payload: Dict[str, Any], tenant_id: str, tx_id: Optional[str] = None) -> Dict[str, Any]:
        record_id = payload.get("Id")
        if not record_id:
            raise ValueError("Cannot insert record without an 'Id'.")

        query = """
            INSERT INTO erp_records (id, object_name, tenant_id, payload)
            VALUES ($1, $2, $3, $4::jsonb);
        """

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            await conn.execute(query, record_id, object_name, tenant_id, json.dumps(payload))
        else:
            async with self.pool.acquire() as c:
                await c.execute(query, record_id, object_name, tenant_id, json.dumps(payload))

        print(f"[Postgres DB] Inserted record '{record_id}' into '{object_name}' for Tenant '{tenant_id}'")
        return dict(payload)

    async def get_record_by_id(self, object_name: str, record_id: str, tenant_id: str, tx_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        query = """
            SELECT payload FROM erp_records
            WHERE tenant_id = $1 AND object_name = $2 AND id = $3;
        """



        conn = self.active_transactions.get(tx_id) if tx_id else None

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            row = await conn.fetchrow(query, tenant_id, object_name, record_id)
        else:
            async with self.pool.acquire() as c:
                row = await c.fetchrow(query, tenant_id, object_name, record_id)

        if row:
            return json.loads(row["payload"])
        return None

    async def update_record(self, object_name: str, record_id: str, payload: Dict[str, Any], tenant_id: str, tx_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        # Pass tx_id to ensure we read from the active transaction context
        existing = await self.get_record_by_id(object_name, record_id, tenant_id, tx_id=tx_id)
        if not existing:
            return None

        # Merge updates with existing record
        updated_payload = {**existing, **payload}

        query = """
            UPDATE erp_records
            SET payload = $1::jsonb
            WHERE tenant_id = $2 AND object_name = $3 AND id = $4;
        """

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            await conn.execute(query, json.dumps(updated_payload), tenant_id, object_name, record_id)
        else:
            async with self.pool.acquire() as c:
                await c.execute(query, json.dumps(updated_payload), tenant_id, object_name, record_id)

        print(f"[Postgres DB] Updated record '{record_id}' in '{object_name}' for Tenant '{tenant_id}'")
        return updated_payload

    # async def query_records(self, object_name: str, filters: Dict[str, Any], tenant_id: str, tx_id: Optional[str] = None) -> List[Dict[str, Any]]:
    #     base_query = "SELECT payload FROM erp_records WHERE tenant_id = $1 AND object_name = $2"
    #     params = [tenant_id, object_name]
    # 
    #     filter_clauses = []
    #     for idx, (key, value) in enumerate(filters.items(), start=3):
    #         filter_clauses.append(f"payload->>'{key}' = ${idx}")
    #         params.append(str(value))
    # 
    #     if filter_clauses:
    #         query = f"{base_query} AND " + " AND ".join(filter_clauses) + ";"
    #     else:
    #         query = f"{base_query};"
    # 
    #     conn = self.active_transactions.get(tx_id) if tx_id else None
    #     if conn:
    #         rows = await conn.fetch(query, *params)
    #     else:
    #         async with self.pool.acquire() as c:
    #             rows = await c.fetch(query, *params)
    # 
    #     return [json.loads(row["payload"]) for row in rows]
    # async def query_records(self, object_name: str, filters: Any, tenant_id: str) -> List[Dict[str, Any]]:
    # async def query_records(self, object_name: str, filters: Any, tenant_id: str, tx_id: Optional[str] = None) -> List[Dict[str, Any]]:
    async def query_records(self, object_name: str, filters: Any, tenant_id: str, tx_id: Optional[str] = None, limit: Optional[int] = None, logic: str = "AND") -> List[Dict[str, Any]]:

        # Start with the base query and tenant isolation
        base_query = f"SELECT id, payload FROM erp_records WHERE object_name = $1 AND tenant_id = $2"
        params = [object_name, tenant_id]

        # Allowed operators mapped directly to safe SQL equivalents
        sql_op_map = {
            "==": "=", "!=": "!=",
            ">": ">", "<": "<",
            ">=": ">=", "<=": "<="
        }

        where_clauses = []

        # --- NEW: Process Structured JSON Array ---
        if isinstance(filters, list):
            for i, condition in enumerate(filters):
                field = condition.get("field")
                op = condition.get("operator", "==")
                val = condition.get("value")

                # Fallback to standard equals if operator is unknown/malicious
                sql_op = sql_op_map.get(op, "=")

                # Use JSONB path querying in Postgres (e.g., payload->>'Amount' > $3)
                param_index = len(params) + 1
                # Check for standard fields vs payload fields
                if field in ["id", "object_name", "tenant_id"]:
                    where_clauses.append(f"{field} {sql_op} ${param_index}")
                else:
                    # Cast the JSONB text to numeric if we are doing math comparisons
                    if sql_op in [">", "<", ">=", "<="]:
                        where_clauses.append(f"(payload->>'{field}')::numeric {sql_op} ${param_index}")
                    else:
                        where_clauses.append(f"payload->>'{field}' {sql_op} ${param_index}")

                params.append(val)

        # --- FALLBACK: Legacy Dictionary Format ---
        # elif isinstance(filters, dict):
        #     for field, val in filters.items():
        #         param_index = len(params) + 1
        #         if field in ["id", "object_name", "tenant_id"]:
        #             where_clauses.append(f"{field} = ${param_index}")
        #         else:
        #             where_clauses.append(f"payload->>'{field}' = ${param_index}")
        #         params.append(val)

        ## Finalize and execute
        # if where_clauses:
        #     base_query += " AND " + " AND ".join(where_clauses)

        if where_clauses:
            # --- NEW: Apply AND/OR logic securely ---
            join_operator = " OR " if logic.upper() == "OR" else " AND "
            # Wrap the conditions in parentheses to isolate them from the tenant/object base query
            base_query += " AND (" + join_operator.join(where_clauses) + ")"
        # --- NEW: Append SQL LIMIT ---
        if limit:
            base_query += f" LIMIT {int(limit)}"

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            records = await conn.fetch(base_query, *params)
        else:
            async with self.pool.acquire() as c:
                records = await c.fetch(base_query, *params)

        # return [{"id": r["id"], **(r["payload"] or {})} for r in records]

        # --- NEW: Safely parse the JSON string before unpacking ---
        parsed_results = []
        for r in records:
            raw_payload = r["payload"]
            # Parse the string into a dict if needed
            payload_dict = json.loads(raw_payload) if isinstance(raw_payload, str) else (raw_payload or {})
            parsed_results.append({"id": r["id"], **payload_dict})

        return parsed_results

    async def delete_record(self, object_name: str, record_id: str, tenant_id: str, tx_id: Optional[str] = None) -> bool:
        query = """
            DELETE FROM erp_records
            WHERE tenant_id = $1 AND object_name = $2 AND id = $3;
        """

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            result = await conn.execute(query, tenant_id, object_name, record_id)
        else:
            async with self.pool.acquire() as c:
                result = await c.execute(query, tenant_id, object_name, record_id)

        deleted_count = int(result.split(" ")[1]) if " " in result else 0
        if deleted_count > 0:
            print(f"[Postgres DB] Deleted record '{record_id}' from '{object_name}' for Tenant '{tenant_id}'")
            return True
        return False

    async def execute_abstract_query(self, query: 'AbstractQuery', tenant_id: str, tx_id: Optional[str] = None) -> list[dict]:
        """Compiles and executes an abstract query inside the storage layer."""
        compiler = PostgresJsonbCompiler()
        compiled_sql = compiler.compile(query, tenant_id)
        print(f"[Postgres Adapter] Executing SQL: {compiled_sql}")

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            rows = await conn.fetch(compiled_sql)
        else:
            async with self.pool.acquire() as c:
                rows = await c.fetch(compiled_sql)

        results = []
        for row in rows:
            row_dict = dict(row)
            if "payload" in row_dict:
                if isinstance(row_dict["payload"], str):
                    results.append(json.loads(row_dict["payload"]))
                else:
                    results.append(row_dict["payload"])
            else:
                results.append(row_dict)

        return results

    async def calculate_rollup(
        self,
        tenant_id: str,
        child_object: str,
        parent_field_name: str,
        parent_id: str,
        operation: str,
        target_field: Optional[str] = None,
        tx_id: Optional[str] = None
    ) -> float:
        """
        Executes a dynamic JSONB aggregation query directly in PostgreSQL.
        """
        base_query = """
            FROM erp_records
            WHERE tenant_id = $1
              AND object_name = $2
              AND payload->>$3 = $4
        """

        if operation == 'COUNT':
            select_clause = "SELECT COUNT(id)"
        elif operation in ['SUM', 'MIN', 'MAX']:
            if not target_field:
                raise ValueError(f"Rollup operation {operation} requires a target_field.")
            select_clause = f"SELECT {operation}((payload->>'{target_field}')::numeric)"
        else:
            raise ValueError(f"Unsupported rollup operation: {operation}")

        query = f"{select_clause} {base_query};"

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            result = await conn.fetchval(query, tenant_id, child_object, parent_field_name, parent_id)
        else:
            async with self.pool.acquire() as c:
                result = await c.fetchval(query, tenant_id, child_object, parent_field_name, parent_id)

        return float(result) if result is not None else 0.0

    async def insert_ledger_entry(self, entry: 'LedgerEntry', tx_id: Optional[str] = None) -> None:
        """Persists an audit ledger entry to Postgres."""
        from dataclasses import asdict # <-- Import this at the top of the method or file
        import json

        query = """
            INSERT INTO erp_audit_ledger
            (tenant_id, transaction_id, object_name, record_id, actor_id, action, timestamp, deltas)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """

        # # Architecturally pure serialization
        deltas_json = json.dumps([asdict(d) for d in entry.deltas]) if entry.deltas else "[]"

        naive_timestamp = entry.timestamp.replace(tzinfo=None)

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            await conn.execute(query, entry.tenant_id, entry.transaction_id, entry.object_name,
                               entry.record_id, entry.actor_id, entry.action, naive_timestamp, deltas_json)
        else:
            async with self.pool.acquire() as c:
                await c.execute(query, entry.tenant_id, entry.transaction_id, entry.object_name,
                                entry.record_id, entry.actor_id, entry.action, naive_timestamp, deltas_json)

    async def get_ledger_entries(self, tenant_id: str, record_id: str, tx_id: Optional[str] = None) -> List['LedgerEntry']:
        """Retrieves audit history for a specific record."""
        from foundation.core.temporal_types import LedgerEntry, AuditDelta

        query = """
            SELECT tenant_id, transaction_id, object_name, record_id, actor_id, action, timestamp, deltas
            FROM erp_audit_ledger
            WHERE tenant_id = $1 AND record_id = $2
            ORDER BY timestamp ASC;
        """

        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            rows = await conn.fetch(query, tenant_id, record_id)
        else:
            async with self.pool.acquire() as c:
                rows = await c.fetch(query, tenant_id, record_id)

        history = []
        for row in rows:
            deltas_data = json.loads(row['deltas']) if row['deltas'] else []
            deltas = [AuditDelta(**d) for d in deltas_data]
            history.append(LedgerEntry(
                transaction_id=row['transaction_id'],
                tenant_id=row['tenant_id'],
                object_name=row['object_name'],
                record_id=row['record_id'],
                actor_id=row['actor_id'],
                action=row['action'],
                timestamp=row['timestamp'],
                deltas=deltas
            ))
        return history


    async def get_record_by_external_id(self, object_name: str, external_field: str, external_id: str, tenant_id: str, tx_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Queries a record securely using a JSONB field path."""
        query = f"""
            SELECT payload FROM erp_records
            WHERE tenant_id = $1 AND object_name = $2 AND payload->>'{external_field}' = $3;
        """
        
        conn = self.active_transactions.get(tx_id) if tx_id else None
        if conn:
            row = await conn.fetchrow(query, tenant_id, object_name, external_id)
        else:
            async with self.pool.acquire() as c:
                row = await c.fetchrow(query, tenant_id, object_name, external_id)

        if row:
            import json
            return json.loads(row["payload"])
        return None