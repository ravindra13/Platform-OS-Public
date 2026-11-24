# foundation/expressions/context_builder.py
from typing import Dict, Any, List, Optional
from runtime.query.query_pipeline import QueryPipelineOrchestrator
from runtime.context.context_models import RequestContext
from foundation.expressions.expression_evaluator import ExpressionEvaluator
from foundation.core.query_types import AbstractQuery, QueryFilter

class ExpressionContextBuilder:
    """Prepares a hydrated data context for any expression evaluation."""

    def __init__(self, query_pipeline: QueryPipelineOrchestrator):
        self.query_pipeline = query_pipeline

    async def build_context(
        self,
        object_name: str,
        expressions: List[str],
        payload: Dict[str, Any],
        existing_record: Optional[Dict[str, Any]],
        # context: ExecutionContext
        context: RequestContext,
        system_fields: List[str] = None, # ADDED
        tx_id: str = None
    ) -> Dict[str, Any]:

        # # 1. Pre-merge existing and payload into an in-memory state
        merged_state = (existing_record or {}).copy()
        for key, value in payload.items():
            if key in merged_state and isinstance(merged_state[key], dict) and not isinstance(value, dict):
                merged_state[key]['Id'] = value
            else:
                merged_state[key] = value
        # # 2. Gather required fields
        # required_fields = set()
        required_fields = set(system_fields or [])
        for expr in expressions:
            deps = ExpressionEvaluator.extract_dependencies(expr)
            required_fields.update(deps)

        if not required_fields:
            return merged_state

        # # 3. IF UPDATE: Fetch missing base fields from the DB
        # # We only do this if the record already exists!
        if existing_record and existing_record.get('Id'):
            query = AbstractQuery(
                object_name=object_name,
                fields=list(required_fields),
                filters=[QueryFilter(field='Id', operator='=', value=existing_record['Id'])],
                limit=1
            )
            result = await self.query_pipeline.execute_query(query, context, tx_id=tx_id)
            if result.records:
                for k, v in result.records[0].items():
                    if k not in payload:
                        merged_state[k] = v

        # # 4. HYDRATE RELATIONS (The Magic Fix)
        # # We manually parse the dependency tree and stitch relations directly into our in-memory payload
        query_tree = await self.query_pipeline.parser.parse_query(object_name, list(required_fields))

        if query_tree.relations:
            # # Wrap our dict in a list so the stitcher can process it
            records_to_stitch = [merged_state]
            await self.query_pipeline._stitch_relations(records_to_stitch, query_tree.relations, context)

            # # ADD THIS EXACT LINE: Extract the hydrated dictionary back out

        return merged_state
