from fastapi import APIRouter
from pydantic import BaseModel
from api.dependencies import services
import uuid

router = APIRouter(prefix="/api/v1/pdf", tags=["Document"])

class TestPdfPayload(BaseModel):
    html_body: str

@router.post("/test-generate")
async def test_generate_pdf(payload: TestPdfPayload):
    file_id = f"TEST-{uuid.uuid4().hex[:8].upper()}"
    
    file_path = await services.pdf_service.adapter.generate_and_save(
        html_content=payload.html_body,
        file_id=file_id
    )
    
    return {"status": "success" if file_path else "failed", "file_path": file_path}