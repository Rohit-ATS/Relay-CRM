from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.seed_data import SAMPLE_CSV_CONTENT
from app.schemas.import_export import (
    CSVImportRequest,
    CSVImportPreviewResponse,
    CSVImportResultResponse,
    CSVLeadRow
)
from app.services.import_service import import_service

router = APIRouter(prefix="/api/import", tags=["Import"])


@router.get("/sample", response_class=Response)
@router.get("/sample-csv", response_class=Response)
async def get_sample_csv():
    """Download sample B2B lead list CSV."""
    return Response(
        content=SAMPLE_CSV_CONTENT,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sample_leads.csv"'}
    )


async def _extract_csv_text_and_leads(request: Request):
    content_type = request.headers.get("content-type", "").lower()
    text_to_parse = ""
    leads_list = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                text_to_parse = body.get("csv_text", "")
                raw_leads = body.get("leads")
                if raw_leads and isinstance(raw_leads, list):
                    leads_list = [CSVLeadRow(**item) for item in raw_leads]
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON body: {str(e)}")
    elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        file_obj = form.get("file")
        if file_obj and hasattr(file_obj, "read"):
            content_bytes = await file_obj.read()
            text_to_parse = content_bytes.decode("utf-8", errors="replace")
        elif "csv_text" in form:
            text_to_parse = str(form.get("csv_text", ""))
    else:
        # Fallback: check if raw text or json
        body_bytes = await request.body()
        if body_bytes:
            try:
                import json
                body = json.loads(body_bytes.decode("utf-8", errors="replace"))
                text_to_parse = body.get("csv_text", "")
                if body.get("leads"):
                    leads_list = [CSVLeadRow(**item) for item in body.get("leads")]
            except Exception:
                text_to_parse = body_bytes.decode("utf-8", errors="replace")

    return text_to_parse, leads_list


@router.post("/preview", response_model=CSVImportPreviewResponse)
async def preview_csv_upload(
    request: Request
):
    """
    Validate headers and rows, returning a preview before persisting.
    Accepts multipart file or JSON with csv_text.
    """
    text_to_parse, leads_list = await _extract_csv_text_and_leads(request)

    if leads_list:
        return CSVImportPreviewResponse(
            total_rows=len(leads_list),
            valid_rows=len(leads_list),
            invalid_rows=0,
            errors=[],
            preview=leads_list[:10]
        )

    if not text_to_parse:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide CSV file or csv_text in JSON payload."
        )

    return import_service.preview_csv(text_to_parse)


@router.post("", response_model=CSVImportResultResponse, status_code=status.HTTP_201_CREATED)
async def import_leads(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Import CSV leads into durable Account, Contact, and Deal records.
    Supports file upload or JSON payload with structured leads / csv_text.
    """
    text_to_parse, leads_list = await _extract_csv_text_and_leads(request)

    if leads_list:
        return await import_service.execute_import(db, leads_list)

    if not text_to_parse:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No CSV file or data provided."
        )

    leads, errors = import_service.parse_csv_text(text_to_parse)
    if not leads:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "No valid leads found in CSV", "errors": errors}
        )

    return await import_service.execute_import(db, leads)
