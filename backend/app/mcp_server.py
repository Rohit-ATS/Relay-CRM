"""MCP adapter exposing Relay's complete public API to AI clients.

The adapter deliberately keeps business logic in the FastAPI service. MCP tools
only validate inputs, call the API, and return its typed JSON responses.
"""

import os
import json
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings


API_BASE_URL = os.getenv("RELAY_API_BASE_URL", "http://localhost:8787").rstrip("/")
API_TOKEN = os.getenv("RELAY_API_TOKEN")
TRANSPORT = os.getenv("MCP_TRANSPORT", "stdio")
MCP_HOST = os.getenv("MCP_HOST", "127.0.0.1")
MCP_PORT = int(os.getenv("MCP_PORT", "8000"))
MCP_ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv(
        "MCP_ALLOWED_HOSTS",
        "relay-crm-api.onrender.com,localhost,localhost:*,127.0.0.1,127.0.0.1:*",
    ).split(",")
    if host.strip()
]

mcp = FastMCP(
    "Relay CRM",
    instructions=(
        "Relay is an AI-native CRM. Read records before changing them. "
        "Draft sequences and analyze interactions are safe proposal steps. "
        "Only call approval, confirmation, reset, delete, or other mutation "
        "tools when the user explicitly requests that action."
    ),
    host=MCP_HOST,
    port=MCP_PORT,
    streamable_http_path="/",
    stateless_http=True,
    transport_security=TransportSecuritySettings(allowed_hosts=MCP_ALLOWED_HOSTS),
)


async def _request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
) -> dict[str, Any] | list[Any] | str:
    headers = {"Authorization": f"Bearer {API_TOKEN}"} if API_TOKEN else {}
    async with httpx.AsyncClient(base_url=API_BASE_URL, headers=headers, timeout=30.0) as client:
        response = await client.request(method, path, params=params, json=json)
    if response.is_error:
        raise RuntimeError(f"Relay API returned HTTP {response.status_code}: {response.text[:500]}")
    try:
        payload = response.json()
    except ValueError:
        return response.text
    if not isinstance(payload, (dict, list, str)):
        raise RuntimeError("Relay API returned an unsupported response shape.")
    return payload


def _required(**values: str) -> None:
    if any(not value.strip() for value in values.values()):
        raise ValueError(f"Required values missing: {', '.join(values)}")


@mcp.tool()
async def list_accounts(query: str | None = None, limit: int = 25, offset: int = 0) -> Any:
    """List accounts, optionally filtered by company, domain, or industry."""
    if not 1 <= limit <= 500 or offset < 0:
        raise ValueError("limit must be 1..500 and offset must be non-negative")
    return await _request("GET", "/api/accounts", params={"query": query, "limit": limit, "offset": offset})


@mcp.tool()
async def get_account(account_id: str) -> Any:
    """Get one account with contacts, deals, activities, sequences, and handoffs."""
    _required(account_id=account_id)
    return await _request("GET", f"/api/accounts/{account_id}")


@mcp.tool()
async def create_account(
    company_name: str,
    domain: str | None = None,
    industry: str | None = None,
    summary: str | None = None,
    source_notes: str | None = None,
) -> Any:
    """Create a CRM account."""
    _required(company_name=company_name)
    return await _request("POST", "/api/accounts", json={
        "company_name": company_name, "domain": domain, "industry": industry,
        "summary": summary, "source_notes": source_notes,
    })


@mcp.tool()
async def update_account(
    account_id: str,
    company_name: str | None = None,
    domain: str | None = None,
    industry: str | None = None,
    summary: str | None = None,
    source_notes: str | None = None,
) -> Any:
    """Update editable account fields."""
    _required(account_id=account_id)
    payload = {key: value for key, value in {
        "company_name": company_name, "domain": domain, "industry": industry,
        "summary": summary, "source_notes": source_notes,
    }.items() if value is not None}
    if not payload:
        raise ValueError("At least one account field is required")
    return await _request("PATCH", f"/api/accounts/{account_id}", json=payload)


@mcp.tool()
async def delete_account(account_id: str) -> Any:
    """Delete an account and its related records. This is irreversible."""
    _required(account_id=account_id)
    return await _request("DELETE", f"/api/accounts/{account_id}")


@mcp.tool()
async def list_contacts(account_id: str | None = None) -> Any:
    """List contacts, optionally filtered by account."""
    return await _request("GET", "/api/contacts", params={"account_id": account_id} if account_id else None)


@mcp.tool()
async def get_contact(contact_id: str) -> Any:
    """Get one contact."""
    _required(contact_id=contact_id)
    return await _request("GET", f"/api/contacts/{contact_id}")


@mcp.tool()
async def create_contact(
    account_id: str,
    name: str,
    email: str,
    title: str | None = None,
    linkedin_url: str | None = None,
    status: str = "lead",
) -> Any:
    """Create a contact linked to an account."""
    _required(account_id=account_id, name=name, email=email)
    return await _request("POST", "/api/contacts", json={
        "account_id": account_id, "name": name, "email": email,
        "title": title, "linkedin_url": linkedin_url, "status": status,
    })


@mcp.tool()
async def update_contact(
    contact_id: str,
    name: str | None = None,
    title: str | None = None,
    email: str | None = None,
    linkedin_url: str | None = None,
    status: str | None = None,
) -> Any:
    """Update editable contact fields."""
    _required(contact_id=contact_id)
    payload = {key: value for key, value in {
        "name": name, "title": title, "email": email,
        "linkedin_url": linkedin_url, "status": status,
    }.items() if value is not None}
    if not payload:
        raise ValueError("At least one contact field is required")
    return await _request("PATCH", f"/api/contacts/{contact_id}", json=payload)


@mcp.tool()
async def list_deals(account_id: str | None = None, stage: str | None = None) -> Any:
    """List deals, optionally filtered by account or pipeline stage."""
    return await _request("GET", "/api/deals", params={
        key: value for key, value in {"account_id": account_id, "stage": stage}.items() if value
    } or None)


@mcp.tool()
async def get_deal(deal_id: str) -> Any:
    """Get one deal."""
    _required(deal_id=deal_id)
    return await _request("GET", f"/api/deals/{deal_id}")


@mcp.tool()
async def create_deal(
    account_id: str,
    name: str,
    stage: str = "Prospecting",
    value: float | None = None,
    next_step: str | None = None,
    owner: str = "Founder",
) -> Any:
    """Create a deal linked to an account."""
    _required(account_id=account_id, name=name)
    return await _request("POST", "/api/deals", json={
        "account_id": account_id, "name": name, "stage": stage,
        "value": value, "next_step": next_step, "owner": owner,
    })


@mcp.tool()
async def update_deal(
    deal_id: str,
    stage: str | None = None,
    value: float | None = None,
    next_step: str | None = None,
    owner: str | None = None,
    name: str | None = None,
) -> Any:
    """Update a deal; stage changes are added to the CRM activity timeline."""
    _required(deal_id=deal_id)
    payload = {key: value for key, value in {
        "stage": stage, "value": value, "next_step": next_step,
        "owner": owner, "name": name,
    }.items() if value is not None}
    if not payload:
        raise ValueError("At least one deal field is required")
    return await _request("PATCH", f"/api/deals/{deal_id}", json=payload)


@mcp.tool()
async def list_activities(account_id: str | None = None, limit: int = 100) -> Any:
    """Read the immutable CRM activity timeline."""
    if not 1 <= limit <= 500:
        raise ValueError("limit must be 1..500")
    return await _request("GET", "/api/activities", params={
        "account_id": account_id, "limit": limit,
    } if account_id else {"limit": limit})


@mcp.tool()
async def add_activity(
    account_id: str,
    activity_type: str,
    summary: str,
    source: str = "user",
    contact_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Any:
    """Add a manual note or activity to an account timeline."""
    _required(account_id=account_id, activity_type=activity_type, summary=summary)
    return await _request("POST", "/api/activities", json={
        "account_id": account_id, "contact_id": contact_id, "type": activity_type,
        "summary": summary, "source": source, "metadata_json": metadata,
    })


@mcp.tool()
async def list_handoffs(status: str | None = None) -> Any:
    """Read the warm-lead handoff queue."""
    return await _request("GET", "/api/handoffs", params={"status": status} if status else None)


@mcp.tool()
async def update_handoff(
    task_id: str,
    status: str | None = None,
    title: str | None = None,
    reason: str | None = None,
) -> Any:
    """Update a handoff task, usually to completed or dismissed."""
    _required(task_id=task_id)
    payload = {key: value for key, value in {
        "status": status, "title": title, "reason": reason,
    }.items() if value is not None}
    if not payload:
        raise ValueError("At least one handoff field is required")
    return await _request("PATCH", f"/api/handoffs/{task_id}", json=payload)


@mcp.tool()
async def import_leads(csv_text: str) -> Any:
    """Import CSV leads into linked accounts, contacts, deals, and activities."""
    _required(csv_text=csv_text)
    return await _request("POST", "/api/import", json={"csv_text": csv_text})


@mcp.tool()
async def preview_import(csv_text: str) -> Any:
    """Validate and preview CSV leads without persisting them."""
    _required(csv_text=csv_text)
    return await _request("POST", "/api/import/preview", json={"csv_text": csv_text})


@mcp.tool()
async def get_sample_csv() -> Any:
    """Download the synthetic sample lead CSV used by the demo."""
    return await _request("GET", "/api/import/sample")


@mcp.tool()
async def generate_account_brief(account_id: str, custom_instructions: str | None = None) -> Any:
    """Generate a source-labeled account brief without inventing sourced facts."""
    _required(account_id=account_id)
    return await _request("POST", "/api/enrich", json={
        "account_id": account_id, "custom_instructions": custom_instructions,
    })


@mcp.tool()
async def get_account_brief(account_id: str) -> Any:
    """Read the stored account brief."""
    _required(account_id=account_id)
    return await _request("GET", f"/api/enrich/{account_id}/brief")


@mcp.tool()
async def create_sequence(account_id: str, notes: str | None = None, custom_angle: str | None = None) -> Any:
    """Generate an editable 3-step sequence draft; it remains pending for human review."""
    _required(account_id=account_id)
    return await _request("POST", "/api/sequence", json={
        "account_id": account_id, "notes": notes, "custom_angle": custom_angle,
    })


@mcp.tool()
async def get_sequence(sequence_id: str) -> Any:
    """Read a sequence and its steps."""
    _required(sequence_id=sequence_id)
    return await _request("GET", f"/api/sequence/{sequence_id}")


@mcp.tool()
async def update_sequence_step(
    sequence_id: str,
    step_id: str,
    subject: str | None = None,
    body: str | None = None,
    delay_days: int | None = None,
    rationale: str | None = None,
    status: str | None = None,
) -> Any:
    """Edit a draft sequence step before approval."""
    _required(sequence_id=sequence_id, step_id=step_id)
    payload = {key: value for key, value in {
        "subject": subject, "body": body, "delay_days": delay_days,
        "rationale": rationale, "status": status,
    }.items() if value is not None}
    if not payload:
        raise ValueError("At least one sequence step field is required")
    return await _request("PATCH", f"/api/sequence/{sequence_id}/steps/{step_id}", json=payload)


@mcp.tool()
async def approve_sequence(sequence_id: str, notes: str | None = None) -> Any:
    """Approve a reviewed sequence and record approval; this does not send email."""
    _required(sequence_id=sequence_id)
    return await _request("POST", f"/api/sequence/{sequence_id}/approve", json={"notes": notes})


@mcp.tool()
async def reject_sequence(sequence_id: str, reason: str | None = None) -> Any:
    """Reject a sequence draft and record the reason."""
    _required(sequence_id=sequence_id)
    return await _request("POST", f"/api/sequence/{sequence_id}/reject", json={"reason": reason})


@mcp.tool()
async def analyze_interaction(account_id: str, content: str, channel: str = "email_reply") -> Any:
    """Analyze a reply or call note and return a proposed update without persisting it."""
    _required(account_id=account_id, content=content)
    return await _request("POST", "/api/interactions", json={
        "account_id": account_id, "content": content,
        "channel": channel, "apply_immediately": False,
    })


@mcp.tool()
async def confirm_interaction(
    account_id: str,
    content: str,
    confirmed_stage: str,
    task_title: str,
    task_reason: str,
    channel: str = "email_reply",
    notes: str | None = None,
) -> Any:
    """Persist an interaction update after explicit user approval."""
    _required(
        account_id=account_id, content=content, confirmed_stage=confirmed_stage,
        task_title=task_title, task_reason=task_reason,
    )
    return await _request("POST", "/api/interactions/confirm", json={
        "account_id": account_id, "content": content, "confirmed_stage": confirmed_stage,
        "task_title": task_title, "task_reason": task_reason,
        "channel": channel, "notes": notes,
    })


@mcp.tool()
async def get_qa_status() -> Any:
    """Return API readiness and current CRM record counts."""
    return await _request("GET", "/api/qa/status")


@mcp.tool()
async def verify_import_workflow() -> Any:
    """Run the deterministic import-and-prepare QA workflow."""
    return await _request("GET", "/api/qa/verify-import")


@mcp.tool()
async def verify_handoff_workflow() -> Any:
    """Run the deterministic update-and-handoff QA workflow."""
    return await _request("GET", "/api/qa/verify-handoff")


@mcp.tool()
async def get_demo_data() -> Any:
    """List the synthetic demo accounts available for testing."""
    return await _request("GET", "/api/demo-data")


@mcp.tool()
async def reset_demo(seed: bool = True) -> Any:
    """Reset CRM data for a clean demo run. This destroys current demo data."""
    return await _request("POST", "/api/reset", params={"seed": str(seed).lower()})


@mcp.tool()
async def seed_demo() -> Any:
    """Replace CRM data with the synthetic seeded demo dataset."""
    return await _request("POST", "/api/seed")


@mcp.resource("relay://openapi")
async def openapi_schema() -> str:
    """Expose the live FastAPI OpenAPI schema to MCP clients."""
    result = await _request("GET", "/openapi.json")
    return json.dumps(result, indent=2)


@mcp.resource("relay://documentation")
async def documentation() -> str:
    """Expose the Relay API integration guide."""
    return (
        f"Relay API base URL: {API_BASE_URL}\n"
        "Use relay://openapi for the live schema. "
        "Mutation tools should only be called after user confirmation."
    )


@mcp.prompt()
def prepare_outreach(account_id: str) -> str:
    """Guide an agent through a grounded, human-reviewed outreach workflow."""
    return (
        f"Prepare outreach for Relay account {account_id}. First read the account and brief, "
        "then draft a sequence using only supplied or source-labeled facts. Show the draft "
        "and wait for explicit user approval before calling approve_sequence."
    )


@mcp.prompt()
def process_reply(account_id: str, reply: str) -> str:
    """Guide an agent through proposal, approval, and handoff for a reply."""
    return (
        f"Process this reply for Relay account {account_id}: {reply}\n"
        "Call analyze_interaction first. Present the proposed stage and evidence. "
        "Only call confirm_interaction after the user explicitly approves the exact update."
    )


@mcp.prompt()
def run_demo_proof() -> str:
    """Guide an agent through both deterministic Wren-style proof workflows."""
    return (
        "Run get_qa_status, then verify_import_workflow and verify_handoff_workflow. "
        "Report each pass/fail result and any API error without claiming success when "
        "the response does not say passed."
    )


if __name__ == "__main__":
    if TRANSPORT not in {"stdio", "sse", "streamable-http"}:
        raise SystemExit("MCP_TRANSPORT must be stdio, sse, or streamable-http")
    mcp.run(transport=TRANSPORT)
