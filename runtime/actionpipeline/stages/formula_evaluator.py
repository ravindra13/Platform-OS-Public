import graphlib
from typing import Dict, Any
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine
from foundation.expressions.expression_evaluator import ExpressionEvaluator

class FormulaEvaluatorEngine:
    """
    Evaluates dynamic runtime formulas and expressions using the central AST evaluator,
    with topological sorting for chained formula dependencies.
    """

    def __init__(self, schema_engine: MetadataSchemaEngine):
        self.schema_engine = schema_engine

    async def evaluate_formulas(
        self,
        object_name: str,
        payload: Dict[str, Any],
        hydrated_context: Dict[str, Any]
    ) -> Dict[str, Any]:

        blueprint = await self.schema_engine.get_object_blueprint(object_name)
        if not blueprint:
            return payload

        # # 1. Identify all formula fields and build a dependency graph
        formulas = {}
        dependency_graph = {}

        for field_name, field_def in blueprint.fields.items():
            if isinstance(field_def.config, dict) and "expression" in field_def.config:
                expr = field_def.config["expression"]
                formulas[field_name] = expr

                # # Use your existing AST dependency extractor
                deps = ExpressionEvaluator.extract_dependencies(expr)

                # # Only track dependencies that are also formulas in this object
                formula_deps = [
                    d for d in deps if d in blueprint.fields and
                    isinstance(blueprint.fields[d].config, dict) and
                    "expression" in blueprint.fields[d].config
                ]

                dependency_graph[field_name] = set(formula_deps)

        if not formulas:
            return payload

        # # 2. Topologically sort the formulas so independent ones evaluate first
        try:
            sorter = graphlib.TopologicalSorter(dependency_graph)
            evaluation_order = tuple(sorter.static_order())
        except graphlib.CycleError as e:
            raise ValueError(f"Circular dependency detected in formulas for {object_name}: {e}")

        # # 3. Evaluate in the guaranteed correct order
        for field_name in evaluation_order:
            if field_name not in formulas:
                continue  # Skip non-formula dependencies

            formula_expr = formulas[field_name]
            try:
                # # Delegate to the central ExpressionEvaluator
                calculated_value = ExpressionEvaluator.evaluate(formula_expr, hydrated_context)
                # # Update both the payload and the context immediately
                # # so downstream formulas can use this new value
                payload[field_name] = calculated_value
                hydrated_context[field_name] = calculated_value
                print(f"[Formula Engine] Calculated {object_name}.{field_name} = {calculated_value}")
            except Exception as err:
                raise ValueError(f"Formula Calculation Failed for '{field_name}': {str(err)}")

        return payload
