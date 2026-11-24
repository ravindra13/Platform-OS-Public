# foundation/core/flow_parser.py
from typing import List, Dict, Any
from foundation.core.schema_types import FlowStepDefinition, FlowVariableDefinition

class FlowParser:
    """Dedicated factory for parsing and validating Flow graphs."""

    # --- ADD THIS NEW METHOD ---
    @staticmethod
    def parse_variables(variables_data: List[Any]) -> List[FlowVariableDefinition]:
        if not variables_data:
            return []

        parsed_vars = []
        for v in variables_data:
            # Handle both raw dictionaries (JSON) or Pydantic models (API)
            v_dict = v if isinstance(v, dict) else (v.model_dump() if hasattr(v, 'model_dump') else v.__dict__)

            var_def = FlowVariableDefinition(
                name=v_dict.get('name'),
                data_type=v_dict.get('data_type'),
                object_name=v_dict.get('object_name'),
                is_input=v_dict.get('is_input', False),
                is_output=v_dict.get('is_output', False),
                expression=v_dict.get('expression') # <-- ADD THIS
            )
            parsed_vars.append(var_def)

        return parsed_vars

    @staticmethod
    def parse_steps(steps_data: List[Any]) -> List[FlowStepDefinition]:
        if not steps_data:
            return []

        parsed_steps = []
        for s in steps_data:
            # Handle both raw dictionaries (JSON) or Pydantic models (API)
            s_dict = s if isinstance(s, dict) else (s.model_dump() if hasattr(s, 'model_dump') else s.__dict__)

            step_def = FlowStepDefinition(
                step_id=s_dict.get('step_id'),
                function_name=s_dict.get('function_name'),
                # run_if=s_dict.get('run_if'),
                config=s_dict.get('config', {}),
                true_steps=FlowParser.parse_steps(s_dict.get('true_steps', [])),
                false_steps=FlowParser.parse_steps(s_dict.get('false_steps', [])),
                loop_steps=FlowParser.parse_steps(s_dict.get('loop_steps', []))
            )
            parsed_steps.append(step_def)

        return parsed_steps
