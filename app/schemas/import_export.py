from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CSVLeadRow(BaseModel):
    name: str = Field(..., description="Full name of the contact")
    title: Optional[str] = Field(None, description="Job title, e.g. VP of Engineering")
    company: str = Field(..., description="Company name")
    email: str = Field(..., description="Work email address")
    website: Optional[str] = Field(None, description="Company website domain or URL")
    notes: Optional[str] = Field(None, description="Context, recent news, or qualification notes")


class CSVImportRequest(BaseModel):
    leads: Optional[List[CSVLeadRow]] = None
    csv_text: Optional[str] = None


class CSVImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    errors: List[str] = []
    preview: List[CSVLeadRow] = []


class CSVImportResultResponse(BaseModel):
    imported_accounts: int
    imported_contacts: int
    imported_deals: int
    account_ids: List[str] = []
    details: List[Dict[str, Any]] = []
