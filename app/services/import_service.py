import csv
import io
import re
from typing import List, Tuple, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import Account, Contact, Deal, Activity
from app.schemas.import_export import (
    CSVLeadRow,
    CSVImportPreviewResponse,
    CSVImportResultResponse
)

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")


class ImportService:

    def parse_csv_text(self, csv_text: str) -> Tuple[List[CSVLeadRow], List[str]]:
        """
        Parses raw CSV string, normalizes headers, validates rows.
        Expected headers (flexible/case-insensitive):
        name, title, company, email, website/domain, notes/context
        """
        leads: List[CSVLeadRow] = []
        errors: List[str] = []

        if not csv_text or not csv_text.strip():
            return [], ["CSV content is empty."]

        stream = io.StringIO(csv_text.strip())
        reader = csv.DictReader(stream)

        if not reader.fieldnames:
            return [], ["Unable to detect CSV headers."]

        # Map header names case-insensitively
        header_map: Dict[str, str] = {}
        for h in reader.fieldnames:
            clean = h.strip().lower()
            if clean in ["name", "full name", "contact", "contact name"]:
                header_map["name"] = h
            elif clean in ["title", "job title", "role", "position"]:
                header_map["title"] = h
            elif clean in ["company", "company name", "organization", "account"]:
                header_map["company"] = h
            elif clean in ["email", "email address", "work email"]:
                header_map["email"] = h
            elif clean in ["website", "domain", "url", "company website"]:
                header_map["website"] = h
            elif clean in ["notes", "context", "description", "background", "source_notes"]:
                header_map["notes"] = h

        required = ["name", "company", "email"]
        missing = [r for r in required if r not in header_map]
        if missing:
            return [], [f"Missing required CSV column(s): {', '.join(missing)}"]

        row_idx = 1
        for row in reader:
            row_idx += 1
            name = (row.get(header_map["name"]) or "").strip()
            company = (row.get(header_map["company"]) or "").strip()
            email = (row.get(header_map["email"]) or "").strip()
            title = (row.get(header_map.get("title", "")) or "").strip() or None
            website = (row.get(header_map.get("website", "")) or "").strip() or None
            notes = (row.get(header_map.get("notes", "")) or "").strip() or None

            if not name or not company or not email:
                errors.append(f"Row {row_idx}: Skipped due to missing name, company, or email.")
                continue

            if "@" not in email:
                errors.append(f"Row {row_idx}: Invalid email address '{email}'.")
                continue

            leads.append(
                CSVLeadRow(
                    name=name,
                    title=title,
                    company=company,
                    email=email,
                    website=website,
                    notes=notes
                )
            )

        return leads, errors

    def preview_csv(self, csv_text: str) -> CSVImportPreviewResponse:
        leads, errors = self.parse_csv_text(csv_text)
        return CSVImportPreviewResponse(
            total_rows=len(leads) + len(errors),
            valid_rows=len(leads),
            invalid_rows=len(errors),
            errors=errors,
            preview=leads[:10]  # first 10 for preview
        )

    async def execute_import(
        self,
        db: AsyncSession,
        leads: List[CSVLeadRow]
    ) -> CSVImportResultResponse:
        imported_accounts = 0
        imported_contacts = 0
        imported_deals = 0
        account_ids: List[str] = []
        details: List[Dict[str, Any]] = []

        for lead in leads:
            # Clean domain
            domain = lead.website
            if domain:
                domain = domain.replace("https://", "").replace("http://", "").strip("/")

            # 1. Match or Create Account
            stmt = select(Account).where(Account.company_name == lead.company)
            result = await db.execute(stmt)
            account = result.scalar_one_or_none()

            if not account:
                account = Account(
                    company_name=lead.company,
                    domain=domain,
                    summary=f"Imported from CSV lead list. Contact: {lead.name} ({lead.title or 'N/A'}).",
                    source_notes=lead.notes
                )
                db.add(account)
                await db.flush()
                imported_accounts += 1

                # Create initial Deal for new Account
                deal = Deal(
                    account_id=account.id,
                    name=f"{lead.company} - Outbound Deal",
                    stage="Prospecting",
                    value=25000.0,
                    next_step="Generate tailored outbound sequence and review with founder",
                    owner="Founder"
                )
                db.add(deal)
                imported_deals += 1

            account_ids.append(account.id)

            # 2. Match or Create Contact
            stmt_contact = select(Contact).where(Contact.email == lead.email)
            res_contact = await db.execute(stmt_contact)
            contact = res_contact.scalar_one_or_none()

            if not contact:
                contact = Contact(
                    account_id=account.id,
                    name=lead.name,
                    title=lead.title,
                    email=lead.email,
                    source="csv_import",
                    status="lead"
                )
                db.add(contact)
                await db.flush()
                imported_contacts += 1

            # 3. Create Audit Activity
            activity = Activity(
                account_id=account.id,
                contact_id=contact.id if contact else None,
                type="import",
                summary=f"Imported lead {lead.name} ({lead.title or 'Lead'}) at {lead.company} from CSV.",
                source="csv",
                metadata_json={
                    "email": lead.email,
                    "company": lead.company,
                    "notes": lead.notes
                }
            )
            db.add(activity)

            details.append({
                "account_id": account.id,
                "company_name": account.company_name,
                "contact_name": lead.name,
                "email": lead.email
            })

        await db.commit()

        return CSVImportResultResponse(
            imported_accounts=imported_accounts,
            imported_contacts=imported_contacts,
            imported_deals=imported_deals,
            account_ids=list(set(account_ids)),
            details=details
        )


import_service = ImportService()
