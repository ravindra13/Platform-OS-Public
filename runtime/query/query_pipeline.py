from typing import List, Dict, Any
from foundation.core.query_types import AbstractQuery, QueryFilter, LogicalFilter

from runtime.query.runtime_types import QueryExecutionResult
from runtime.query.query_parser import QueryParser, QueryNode
from foundation.security.security_policy_core import SecurityPolicyCore
from foundation.sovereignty.tenant_router import SovereigntyRouter
from foundation.core.database_adapter import DatabaseAdapter
from runtime.context.context_models import RequestContext
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine

class QueryPipelineOrchestrator:
    """
    Processes abstract API queries by evaluating security constraints,
    resolving sovereignty-compliant read targets, compiling SQL, and executing queries.
    """

    def __init__(
        self,
        security_core: SecurityPolicyCore,
        router: SovereigntyRouter,
        db_adapter: DatabaseAdapter,
        parser: QueryParser,
        schema_engine: MetadataSchemaEngine
    ):
        self.security_core = security_core
        self.router = router
        self.db_adapter = db_adapter
        self.parser = parser
        self.schema_engine = schema_engine
    async def execute_query(self, query: AbstractQuery, context: RequestContext, tx_id: str = None) -> QueryExecutionResult:
        print(f"\n[Query Pipeline] Intercepting READ request for object '{query.object_name}'")

        # # Step 0: Parse the dependency tree (Data Loader AST)
        query_tree = await self.parser.parse_query(query.object_name, query.fields)

        # # Step 1: Sovereignty Check & Read Replica Connection
        read_target_node = self.router.get_read_connection(context.user.tenant_id)

        allowed_base_fields = []
        # # Step 2: Object-Level Security Check
        if context.mode == 'USER':

            if not await self.security_core.has_object_access(context.user.user_id, query.object_name, 'READ'):
                raise PermissionError(f"User '{context.user.user_id}' lacks READ access to '{query.object_name}'")

            # # Step 4: FLS Enforcement (Base Object Only)
            for field in query_tree.fields:
                if field == 'Id' or await self.security_core.has_field_access(context.user.user_id, query.object_name, field, 'READ'):
                    allowed_base_fields.append(field)

        else:
            # # Step 4b: SYSTEM mode allows all parsed base fields
            allowed_base_fields = list(query_tree.fields)

        # # OVERRIDE the query fields so the compiler only sees the base fields (no dot-notation)
        query.fields = allowed_base_fields
        # # --- NEW: Fetch the metadata blueprint to check its sharing model ---
        blueprint = await self.schema_engine.get_object_blueprint(query.object_name)

        # # Step 5: Dynamic Query Re-writing (Security Injection)
        # # ARCHITECTURE PURE: Only apply RLS if the object schema explicitly enables it
        if context.mode == 'USER' and getattr(blueprint, 'enable_rls', True):

            # # THE FAST FAIL: Skip building the RLS WHERE clause entirely if they have View All!
            if not await self.security_core.has_object_override(context.user.user_id, query.object_name, 'READ'):

                shared_ids = await self.security_core.repo.get_user_shared_records(context.user.user_id)

                # # --- ARCHITECTURE FIX: SQL Compiler Safeguard ---
                conditions = [QueryFilter(field='OwnerId', operator='=', value=context.user.user_id)]
                if shared_ids:
                    conditions.append(QueryFilter(field='Id', operator='IN', value=shared_ids))

                security_filter = LogicalFilter(
                    operator='OR',
                    conditions=conditions
                )

                query.filters.append(security_filter)
                print(f"[Query Pipeline] Injected RLS Sharing rules for User '{context.user.user_id}'")

            else:
                print(f"[Query Pipeline] RLS Bypassed: User '{context.user.user_id}' has VIEW ALL for '{query.object_name}'")

        # # Step 6: Database-Agnostic Execution
        # # The pipeline has no idea if this is Postgres, Mongo, or a text file!
        raw_records = await self.db_adapter.execute_abstract_query(query, context.user.tenant_id, tx_id=tx_id)
        # # Step 7: Post-Query Field Masking (Base)
        masked_records = []
        for record in raw_records:
            filtered_rec = {k: v for k, v in record.items() if not query.fields or k in query.fields or k == 'Id'}
            masked_records.append(filtered_rec)

        # # Step 8: THE DATA LOADER (Cross-Object Stitching)
        if query_tree.relations:
            await self._stitch_relations(masked_records, query_tree.relations, context, tx_id=tx_id)

        return QueryExecutionResult(
            query_ast=query, compiled_sql=None, target_node=read_target_node, records=masked_records
        )

    async def _stitch_relations(self, base_records: List[Dict[str, Any]], relations: Dict[str, QueryNode], context: RequestContext, tx_id: str = None) -> None:
        """Recursively batches and fetches cross-object relational data without N+1 queries."""
        if not base_records:
            return

        for relation_field, target_node in relations.items():
            # # 1. Extract all unique Foreign Keys from the base records
            fk_ids = list({rec.get(relation_field) for rec in base_records if rec.get(relation_field)})
            if not fk_ids:
                continue

            # # 2. Build a recursive sub-query for the target object using the IN operator
            # # FIXED: We pass the exact target fields, not dot-notated fields
            sub_query = AbstractQuery(
                object_name=target_node.object_name,
                fields=list(target_node.fields),
                filters=[QueryFilter(field='Id', operator='IN', value=fk_ids)],
                limit=None
            )

            # # 3. Recursively run the pipeline to fetch securely
            sub_result = await self.execute_query(sub_query, context, tx_id=tx_id)

            # # 4. Map the related records by ID for O(1) lookup
            related_map = {rec['Id']: rec for rec in sub_result.records if 'Id' in rec}

            # # 5. Stitch the related JSON object into the base records
            for record in base_records:
                fk_val = record.get(relation_field)

                if not fk_val or fk_val not in related_map:
                    continue

                relation_name = relation_field
                if relation_name.endswith('Id'):
                    relation_name = relation_name[:-2]
                else:
                    relation_name = f"{relation_name}_Obj"

                # # Attach the populated dictionary to the NEW property name
                record[relation_name] = related_map[fk_val].copy()
