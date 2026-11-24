# capabilities/migration/router.py
import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from fastapi.responses import Response, FileResponse
from typing import Optional
from runtime.context.context_models import RequestContext
from api.dependencies import get_request_context, services

router = APIRouter(prefix="/api/v1/migration", tags=["Data Migration"])

# --- SYNCHRONOUS CAPABILITIES ---

@router.get("/{object_name}/export")
async def export_records(
    object_name: str,
    context: RequestContext = Depends(get_request_context)
):
    try:
        csv_data = await services.migration_service.export_data(
            object_name=object_name, 
            context=context
        )
        return Response(
            content=csv_data, 
            media_type="text/csv", 
            headers={"Content-Disposition": f"attachment; filename={object_name}_export.csv"}
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- ASYNCHRONOUS CAPABILITIES (IMPORT & BULK EXPORT) ---

@router.post("/{object_name}/import")
async def import_records(
    object_name: str,
    file: UploadFile = File(...),
    field_mapping: Optional[str] = Form(None), # e.g. '{"Old_ID": "account_id"}'
    context: RequestContext = Depends(get_request_context)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
        
    content = await file.read()
    csv_text = content.decode("utf-8")
    
    try:
        result = await services.migration_service.import_data(
            object_name=object_name, 
            csv_text=csv_text, 
            mapping_json=field_mapping,
            context=context
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export/bulk")
async def trigger_bulk_export(context: RequestContext = Depends(get_request_context)):
    try:
        result = await services.migration_service.request_bulk_export(context)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- UNIFIED SYSTEM JOB TRACKING ---

@router.get("/jobs/{job_id}")
async def check_job_status(
    job_id: str, 
    context: RequestContext = Depends(get_request_context)
):
    try:
        status_record = await services.migration_service.get_job_status(job_id, context)
        payload = status_record.get("Payload", {})
        
        return {
            "JobType": status_record.get("JobType"),
            "Status": status_record.get("Status"), 
            "error_log": payload.get("error"),
            "metrics": payload # Will surface row counts for imports
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}/download")
async def download_export(
    job_id: str, 
    context: RequestContext = Depends(get_request_context)
):
    try:
        status_record = await services.migration_service.get_job_status(job_id, context)
        
        if status_record.get("Status") != "COMPLETED":
            raise HTTPException(status_code=400, detail="Job is not yet completed.")
            
        if status_record.get("JobType") != "BULK_EXPORT":
            raise HTTPException(status_code=400, detail="This job type does not produce a downloadable file.")
            
        payload = status_record.get("Payload", {})
        file_path = payload.get("file_path")
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Export file not found on server.")
            
        return FileResponse(
            path=file_path,
            media_type="application/zip",
            filename=f"erp_export_{job_id}.zip"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs")
async def list_recent_jobs(limit: int = 10, context: RequestContext = Depends(get_request_context)):
    try:
        jobs = await services.migration_service.get_recent_jobs(context, limit)
        return jobs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))