from fastapi import APIRouter, Depends
from pydantic import BaseModel
from runtime.context.context_models import RequestContext
from api.dependencies import get_request_context, services

router = APIRouter(prefix="/api/v1/template", tags=["Template"])

class RenderPreviewPayload(BaseModel):
    template_code: str
    parent_object: str
    parent_record_id: str

@router.post("/preview")
async def preview_template(
    payload: RenderPreviewPayload,
    context: RequestContext = Depends(get_request_context)
):
    rendered = await services.template_service.render_template(
        template_code=payload.template_code,
        parent_object=payload.parent_object,
        parent_record_id=payload.parent_record_id,
        tenant_id=context.user.tenant_id
    )
    return {"status": "success", "data": rendered}