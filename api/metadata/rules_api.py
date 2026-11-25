from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel
from api.dependencies import services, require_system_caller
from foundation.core.schema_types import ValidationRuleDefinition

router = APIRouter()

class APIValidationRuleRequest(BaseModel):
    rule_id: str
    error_condition_expr: str
    error_message: str

@router.post("/schema/{object_name}/validation-rule")
async def add_validation_rule(
    object_name: str,
    rule_req: APIValidationRuleRequest,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER"),
     _: None = Depends(require_system_caller)
):
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM / Admin mode can manage metadata rules.")

    rule_def = ValidationRuleDefinition(
        rule_id=rule_req.rule_id,
        error_condition_expr=rule_req.error_condition_expr,
        error_message=rule_req.error_message
    )

    try:
        await services.schema_engine.add_validation_rule(object_name, rule_def)
        return {"status": "Success", "message": f"Registered validation rule '{rule_req.rule_id}' on '{object_name}'"}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))

from typing import Optional

class RuleUpdateRequest(BaseModel):
    error_condition_expr: Optional[str] = None
    error_message: Optional[str] = None

@router.put("/schema/{object_name}/validation-rule/{rule_id}")
async def update_validation_rule(
    object_name: str,
    rule_id: str,
    req: RuleUpdateRequest,
    x_execution_mode: str = Header("USER"),
     _: None = Depends(require_system_caller)
):
    """Admin endpoint to modify an existing validation rule."""
    if x_execution_mode != 'SYSTEM':
        raise HTTPException(status_code=403, detail="Only SYSTEM / Admin mode can modify rules.")

    try:
        # Delegate directly to the schema engine
        await services.schema_engine.update_validation_rule(
            object_name=object_name,
            rule_id=rule_id,
            error_condition_expr=req.error_condition_expr,
            error_message=req.error_message
        )
        return {"status": "Success", "message": f"Rule '{rule_id}' updated successfully."}
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))
