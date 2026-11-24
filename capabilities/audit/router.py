from fastapi import APIRouter, Depends
from runtime.context.context_models import RequestContext
from api.dependencies import get_request_context, services

router = APIRouter(prefix="/api/v1/audit", tags=["Audit Ledger"])

@router.get("/{object_name}/{record_id}")
async def get_ledger(
    object_name: str,
    record_id: str,
    context: RequestContext = Depends(get_request_context)
):
    # Route through the capability service for security
    history = await services.audit_service.get_record_history(
        object_name=object_name,
        record_id=record_id,
        context=context
    )
    return {"status": "success", "object_name": object_name, "record_id": record_id, "data": history}
