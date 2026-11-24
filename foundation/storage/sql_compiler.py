from typing import Union
from foundation.core.query_types import AbstractQuery, QueryFilter, LogicalFilter

class PostgresJsonbCompiler:
    """
    Compiles an AbstractQuery into a Postgres JSONB SQL query string.
    Targeting the erp_records table and JSONB payload column.
    """

    def compile(self, query: AbstractQuery, tenant_id: str) -> str:
        # 1. Pure Projection Pushdown: Construct a new, strict JSONB object in the DB
        if query.fields:
            build_args = []
            for f in query.fields:
                # The key name as text
                build_args.append(f"'{f}'")
                # The value as native JSONB (using -> instead of ->> to preserve types)
                build_args.append(f"payload->'{f}'")

            # Alias it AS payload so your postgres_records.py adapter parses it correctly
            select_sql = f"jsonb_build_object({','.join(build_args)}) AS payload"
        else:
            select_sql = "payload"

        # 2. Build the base FROM and WHERE for Tenant Isolation
        base_sql = f"SELECT {select_sql} FROM erp_records WHERE object_name = '{query.object_name}' AND tenant_id = '{tenant_id}'"

        # 3. Compile Filters recursively
        filter_sqls = []
        for f in query.filters:
            compiled_f = self._compile_condition(f)
            if compiled_f:
                filter_sqls.append(compiled_f)

        # 4. Assemble final query string
        if filter_sqls:
            final_sql = f"{base_sql} AND " + " AND ".join(filter_sqls)
        else:
            final_sql = base_sql

        if query.limit:
            final_sql += f" LIMIT {query.limit}"

        return final_sql

    def _compile_condition(self, condition: Union[QueryFilter, LogicalFilter]) -> str:
        # Recursive Case: Handle Logical OR / AND groupings
        if isinstance(condition, LogicalFilter):
            inner_sqls = [self._compile_condition(c) for c in condition.conditions]
            inner_sqls = [sql for sql in inner_sqls if sql]
            if not inner_sqls:
                return ""

            joined = f" {condition.operator} ".join(inner_sqls)
            return f"({joined})"

        # Base Case: Handle standard QueryFilter
        f = condition
        if isinstance(f.value, str):
            val = f"'{f.value}'"
        elif isinstance(f.value, list) and f.operator == 'IN':
            # Securely handle empty lists (e.g., user has no shared records)
            if not f.value:
                return "1=0"
            val = "(" + ", ".join([f"'{v}'" if isinstance(v, str) else str(v) for v in f.value]) + ")"
        else:
            val = str(f.value)

        return f"payload->>'{f.field}' {f.operator} {val}"
