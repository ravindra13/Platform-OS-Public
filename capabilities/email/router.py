from fastapi import APIRouter
from pydantic import BaseModel
from api.dependencies import services

router = APIRouter(prefix="/api/v1/email", tags=["Email"])

class TestEmailPayload(BaseModel):
    to_address: str
    subject: str
    body: str

@router.post("/test-send")
async def test_send_email(payload: TestEmailPayload):
    # Call the adapter directly, bypassing templates, flow engine, and database
    success = await services.email_service.adapter.send_transactional_email(
        to_address=payload.to_address,
        subject=payload.subject,
        html_body=payload.body
    )
    return {"status": "success" if success else "failed", "delivered": success}