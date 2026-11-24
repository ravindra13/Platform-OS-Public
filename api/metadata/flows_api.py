from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

# Assuming these are imported from your local project structure
from api.dependencies import services
from foundation.core.schema_types import FlowDefinition, FlowStepDefinition
from foundation.flow.flow_parser import FlowParser

import dataclasses

router = APIRouter()

# 1. Make the Pydantic Schema Recursive
class FlowStepSchema(BaseModel):
    step_id: str
    function_name: str
    config: Dict[str, Any]
    true_steps: List['FlowStepSchema'] = []
    false_steps: List['FlowStepSchema'] = []
    loop_steps: List['FlowStepSchema'] = []

# --- 1. Explicitly resolve recursive forward references ---
try:
    # FastAPI / Pydantic v2 execution path
    FlowStepSchema.model_rebuild()
except AttributeError:
    # FastAPI / Pydantic v1 fallback execution path
    FlowStepSchema.update_forward_refs()


class FlowVariableSchema(BaseModel):
    name: str
    data_type: str  # 'RECORD' or 'RECORD_COLLECTION'
    object_name: Optional[str] = None  # e.g., 'User' or 'Profile'
    is_input: bool = False
    is_output: bool = False
    expression: Optional[str] = None


class FlowDefinitionSchema(BaseModel):
    flow_id: str
    target_object: str
    trigger_event: str
    execution_phase: str = "BEFORE_SAVE"
    variables: List[FlowVariableSchema] = []
    steps: List[FlowStepSchema]



# Add this modified mapping function to flows_api.py

def build_recursive_steps(schema_steps: List[FlowStepSchema]) -> List[FlowStepDefinition]:
    """
    Recursively transforms a Pydantic schema graph into
    the strictly typed Dataclass graph defined in schema_types.py.
    """
    mapped_steps = []
    
    for s in schema_steps:
        # Create the dataclass explicitly
        step_def = FlowStepDefinition(
            step_id=s.step_id,
            function_name=s.function_name,
            config=s.config,
            true_steps=build_recursive_steps(s.true_steps) if s.true_steps else [],
            false_steps=build_recursive_steps(s.false_steps) if s.false_steps else [],
            loop_steps=build_recursive_steps(s.loop_steps) if s.loop_steps else []
        )
        mapped_steps.append(step_def)
        
    return mapped_steps


@router.post("/flows")
async def save_flow_definition(
    flow_req: FlowDefinitionSchema,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM / Admin mode can create flow definitions.")

    # Route the Pydantic payload through the parser
    steps = FlowParser.parse_steps(flow_req.steps)
    variables = FlowParser.parse_variables(flow_req.variables)
    
    flow_def = FlowDefinition(
        flow_id=flow_req.flow_id,
        target_object=flow_req.target_object,
        trigger_event=flow_req.trigger_event,
        execution_phase=flow_req.execution_phase,
        variables=variables,
        steps=steps,
        active=True
    )

    try:
        # --- PURE ARCHITECTURE: Delegate directly to the Domain Layer ---
        await services.schema_engine.upsert_flow_definition(flow_req.target_object, flow_def)
        return {"status": "Success", "message": f"Successfully deployed flow '{flow_req.flow_id}'"}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get("/flows/{object_name}")
async def get_flows_for_object(
    object_name: str,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    blueprint = await services.schema_engine.get_object_blueprint(object_name)
    if not blueprint:
        raise HTTPException(status_code=404, detail=f"Object '{object_name}' not found.")

    # ARCHITECTURE PURE: Deep recursive serialization
    flows = []
    for f in getattr(blueprint, 'flows', []):
        if dataclasses.is_dataclass(f):
            flows.append(dataclasses.asdict(f))
        elif hasattr(f, '__dict__'):
            flows.append(f.__dict__)
        else:
            flows.append(f)

    return {"flows": flows}


@router.get("/flows/actions/available")
async def get_available_flow_actions(
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...)
):
    """
    Called by the Frontend Flow Canvas to populate its drag-and-drop 
    sidebar and configuration panels dynamically.
    """
    actions = FunctionRegistry.get_available_actions()
    return {"actions": actions}