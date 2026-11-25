import operator
from typing import Dict, Any, List, Union
from foundation.flow.function_registry import FunctionRegistry
from foundation.expressions.expression_evaluator import ExpressionEvaluator

class ConfigurableFlowEngine:
    """Executes metadata JSON flow blueprints using recursive graph traversal."""

    MAX_LOOP_ITEMS = 500
    MAX_STEPS_PER_RUN = 2000

    def __init__(self, db_adapter: Any):
        self.db_adapter = db_adapter

    def _resolve_path(self, path: str, context: dict) -> any:
        # 1. Provide the resolver to the evaluator
        if "__resolver__" not in context:
            context["__resolver__"] = self._resolve_path
            context["__step_count__"] = 0
        
        # --- NEW: Lazy Formula Evaluation ---
        formulas = context.get("__formulas__", {})
        if path in formulas:
            # Cycle detection
            active_evals = context.setdefault("__active_evals__", set())
            if path in active_evals:
                raise RecursionError(f"Circular dependency detected in formula: {path}")
                
            active_evals.add(path)
            
            # Evaluate and cache the result permanently
            result = ExpressionEvaluator.evaluate(formulas[path], context)
            context[path] = result 
            
            # Cleanup
            del formulas[path] 
            active_evals.remove(path)
            return result

        keys = path.split('.')
        current_val = context
        for k in keys:
            if isinstance(current_val, dict) and k in current_val:
                current_val = current_val[k]
            else:
                return None
        return current_val

    def _evaluate_json_rules(self, conditions: Union[list, dict], context: dict, logic: str = "AND") -> bool:
        """
        PURE ARCHITECTURE: Evaluates a structured JSON array directly against memory.
        Zero string parsing. Zero AST overhead.
        """
        if not conditions:
            return True

        if isinstance(conditions, dict):
            if "conditions" in conditions:
                return self._evaluate_json_rules(
                    conditions.get("conditions", []),
                    context,
                    conditions.get("condition_logic", "AND").upper()
                )
            conditions = [conditions]

        op_map = {
            "==": operator.eq, "!=": operator.ne,
            ">": operator.gt, "<": operator.lt,
            ">=": operator.ge, "<=": operator.le
        }

        results = []
        for cond in conditions:
            # 1. Safely resolve the left side using dot-notation
            left_key = cond.get("field") or cond.get("left_operand")
            left_val = self._resolve_path(left_key, context) if left_key else None

            # 2. Safely resolve the right side using strict type checking
            right_raw = cond.get("value", "")
            if cond.get("rightOperandType") == "REFERENCE":
                right_val = self._resolve_path(right_raw, context)
            else:
                right_val = right_raw
                
            # Auto-cast to floats for math comparisons
            if isinstance(left_val, str) and isinstance(right_val, (int, float)):
                try: left_val = float(left_val)
                except ValueError: pass
            elif isinstance(right_val, str) and isinstance(left_val, (int, float)):
                try: right_val = float(right_val)
                except ValueError: pass

            op_str = cond.get("operator", "==")
            compare_fn = op_map.get(op_str, operator.eq)


            if op_str == "IS_NULL":
                is_actually_null = (left_val is None or left_val == "")
                # Default to checking for IS NULL, unless explicitly set to "false"
                target_state = False if str(right_val).lower() == "false" else True
                results.append(is_actually_null == target_state)
                continue
            if left_val is None or right_val is None:
                results.append(False if op_str not in ("==", "!=") else compare_fn(left_val, right_val))
            else:
                results.append(compare_fn(left_val, right_val))

        return all(results) if logic == "AND" else any(results)

    async def execute_flow(self, flow_definition: Dict[str, Any], initial_context: Dict[str, Any]) -> Dict[str, Any]:
        context = dict(initial_context)
        context["__resolver__"] = self._resolve_path
        
        steps: List[Dict[str, Any]] = flow_definition.get("steps", [])
        return await self._execute_step_list(steps, context)

    async def _execute_step_list(self, steps: List[Dict[str, Any]], context: Dict[str, Any]) -> Dict[str, Any]:
        for step in steps:

            context["__step_count__"] = context.get("__step_count__", 0) + 1
            if context["__step_count__"] > self.MAX_STEPS_PER_RUN:
                raise RuntimeError(f"Flow stopped: more than {self.MAX_STEPS_PER_RUN} steps in one run.")

            step_id = step.get("step_id", "STEP")
            func_name = step.get("function_name")
            config = step.get("config", {})
            
            print(f"[Flow Engine] Executing step '{step_id}': {func_name}")

            if func_name == "LOGICAL_BRANCH":
                branch_condition = config.get("condition")

                try:
                    if isinstance(branch_condition, (list, dict)):
                        is_true = self._evaluate_json_rules(branch_condition, context)
                    else:
                        is_true = ExpressionEvaluator.evaluate(branch_condition, context)
                except Exception as e:
                    print(f"[Flow Engine Warning] Failed to evaluate branch condition '{branch_condition}': {e}")
                    is_true = False

                print(f"[Flow Engine] Branch condition evaluated to: {is_true}")

                if is_true:
                    true_steps = step.get("true_steps", [])
                    print(f"[Flow Engine] Entering True Path (Found {len(true_steps)} steps)")
                    context = await self._execute_step_list(true_steps, context)
                else:
                    false_steps = step.get("false_steps", [])
                    print(f"[Flow Engine] Entering False Path (Found {len(false_steps)} steps)")
                    context = await self._execute_step_list(false_steps, context)

            elif func_name == "FOR_EACH":
                list_key = config.get("list_key")
                item_alias = config.get("item_alias")
                loop_steps = step.get("loop_steps", [])

                items_to_loop = self._resolve_path(list_key, context) or []

                if isinstance(items_to_loop, list) and len(items_to_loop) > self.MAX_LOOP_ITEMS:
                    raise RuntimeError(
                        f"Flow stopped: the loop over '{list_key}' has {len(items_to_loop)} items; the limit is {self.MAX_LOOP_ITEMS}.")

                print(f"[Flow Engine] Looping over {len(items_to_loop)} items in '{list_key}'.")

                if isinstance(items_to_loop, list):
                    for idx, item in enumerate(items_to_loop):
                        context[item_alias] = item
                        context["__loop_index"] = idx
                        context = await self._execute_step_list(loop_steps, context)

                    context.pop(item_alias, None)
                    context.pop("__loop_index", None)

            else:
                context = await FunctionRegistry.execute(func_name, config, context, self.db_adapter, resolver=self._resolve_path)

        return context