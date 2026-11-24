# api/action_router.py
from typing import List, Dict, Any
from fastapi import APIRouter, Header, HTTPException
from api.dependencies import services

router = APIRouter(prefix="/api/action", tags=["Action Pipeline"])

@router.post("/{object_name}")
async def execute_save(
    object_name: str,
    payloads: List[Dict[str, Any]],
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    try:
        req_context, _ = await services.req_manager.prepare_request(
            x_tenant_id, x_user_id, payloads, initial_mode=x_execution_mode
        )
        
        results = await services.action_pipeline.execute_save(
            object_name, payloads, req_context, allow_partial_success=True
        )
        return {"status": "Complete", "transaction_id": req_context.transaction_id, "results": results}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.delete("/{object_name}")
async def execute_delete(
    object_name: str,
    record_ids: List[str],  # Accepts a JSON array of IDs in the request body for batch deletion
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    try:
        # Prepare the context (empty payload list since we only have IDs)
        req_context, _ = await services.req_manager.prepare_request(
            x_tenant_id, x_user_id, [], initial_mode=x_execution_mode
        )
        
        # Delegate to the Action Pipeline (which handles Security, Cascades, DB, and Audit Ledgers)
        results = await services.action_pipeline.execute_delete(
            object_name, record_ids, req_context
        )
        
        return {
            "status": "Complete", 
            "transaction_id": req_context.transaction_id, 
            "results": results
        }
    except PermissionError as err:
        raise HTTPException(status_code=403, detail=str(err))
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(err)}")