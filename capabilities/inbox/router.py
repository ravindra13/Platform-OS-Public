from fastapi import APIRouter, Depends
from pydantic import BaseModel
from runtime.context.context_models import RequestContext
from api.dependencies import get_request_context, services

router = APIRouter(prefix="/api/v1/inbox", tags=["Inbox"])

class MessagePayload(BaseModel):
    parent_object: str
    parent_record_id: str
    body: str

@router.post("/message")
async def post_message(
    payload: MessagePayload,
    context: RequestContext = Depends(get_request_context)
):
    # Pull the initialized service dynamically from the global container
    saved_msg = await services.inbox_service.add_message(
        parent_object=payload.parent_object,
        parent_record_id=payload.parent_record_id,
        message_body=payload.body,
        context=context
    )
    return {"status": "success", "data": saved_msg}

@router.get("/{parent_object}/{parent_record_id}")
async def get_messages(
    parent_object: str,
    parent_record_id: str,
    context: RequestContext = Depends(get_request_context)
):
    # Pull the initialized service dynamically from the global container
    messages = await services.inbox_service.get_thread_messages(
        parent_object=parent_object,
        parent_record_id=parent_record_id,
        context=context
    )

    return {"status": "success", "count": len(messages), "data": messages}
