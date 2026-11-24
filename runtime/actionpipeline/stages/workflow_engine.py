# runtime/actionpipeline/stages/workflow_engine.py
from typing import Dict, Any, List, Optional
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine
from foundation.expressions.expression_evaluator import ExpressionEvaluator

class WorkflowRule:
    def __init__(
        self,
        rule_id: str,
        source_object: str,
        trigger_event: str,
        condition_expr: str,
        target_object: str,
        target_lookup_field: str,
        actions: List[Dict[str, Any]]
    ):
        self.rule_id = rule_id
        self.source_object = source_object
        self.trigger_event = trigger_event
        self.condition_expr = condition_expr
        self.target_object = target_object
        self.target_lookup_field = target_lookup_field
        self.actions = actions


class CrossObjectWorkflowEngine:
    """Evaluates rule criteria and triggers automated cross-object mutations."""

    def __init__(self, schema_engine: MetadataSchemaEngine, db_adapter: Any):
        self.schema_engine = schema_engine
        self.db_adapter = db_adapter
        self._rules_registry: List[WorkflowRule] = []
    def register_rule(self, rule: WorkflowRule) -> None:
        self._rules_registry.append(rule)

    async def evaluate_and_execute(
        self,
        source_object: str,
        payload: Dict[str, Any],
        existing_record: Optional[Dict[str, Any]],
        tenant_id: str,
        user_id: str,
        tx_id: str,
        physical_save_fn: Any
    ) -> None:
        is_create = existing_record is None
        combined_state = {**(existing_record or {}), **payload}

        matching_rules = [
            r for r in self._rules_registry
            if r.source_object == source_object and self._event_matches(r.trigger_event, is_create)
        ]

        for rule in matching_rules:
            if ExpressionEvaluator.evaluate(rule.condition_expr, combined_state):
                target_id = combined_state.get(rule.target_lookup_field)
                if not target_id:
                    continue

                target_record = await self.db_adapter.get_record_by_id(rule.target_object, target_id, tenant_id)
                if not target_record:
                    continue
                target_payload = {"Id": target_id}
                for action in rule.actions:
                    field_name = action["field"]
                    value_expr = action["value_expr"]
                    calculated_value = ExpressionEvaluator.evaluate(value_expr, combined_state)
                    target_payload[field_name] = calculated_value

                await physical_save_fn(tx_id, tenant_id, user_id, rule.target_object, target_payload)

    def _event_matches(self, trigger_event: str, is_create: bool) -> bool:
        if trigger_event == "ON_CREATE_OR_UPDATE":
            return True
        if trigger_event == "ON_CREATE" and is_create:
            return True
        if trigger_event == "ON_UPDATE" and not is_create:
            return True
        return False
