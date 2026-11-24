# runtime/actionpipeline/stages/validation_stage.py
from typing import Dict, Any, Optional
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine
from foundation.expressions.expression_evaluator import ExpressionEvaluator
from runtime.shared.context_builder import ExpressionContextBuilder
from runtime.context.context_models import RequestContext

class UserValidationRulesStage:
    """Runtime pipeline stage that fetches object validation rules and evaluates them."""

    def __init__(self, schema_engine: MetadataSchemaEngine, context_builder: ExpressionContextBuilder):
        self.schema_engine = schema_engine
        self.context_builder = context_builder

    async def validate(
        self,
        object_name: str,
        payload: Dict[str, Any],
        hydrated_context: Dict[str, Any],
        context: RequestContext
    ) -> None:
        blueprint = await self.schema_engine.get_object_blueprint(object_name)
        if not blueprint or not blueprint.validation_rules:
            return

        # The context is already fully built by the Action Pipeline Orchestrator!
        for rule in blueprint.validation_rules:
            is_invalid = ExpressionEvaluator.evaluate(rule.error_condition_expr, hydrated_context)
            if is_invalid:
                raise ValueError(f"Validation Error ({rule.rule_id}): {rule.error_message}")
