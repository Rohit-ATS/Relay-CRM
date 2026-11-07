from datetime import datetime, timedelta, timezone
from html import escape
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import OAuthAuthorizationCode, OAuthClient
from app.db.session import get_db
from app.oauth import create_access_token, hash_value, normalize_resource, pkce_valid, random_id, redirect_with_code

router = APIRouter(tags=["OAuth"])


def origin(request: Request) -> str:
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()
    host = request.headers.get("host", request.url.netloc)
    return f"{scheme}://{host}".rstrip("/")


def resource_url(request: Request) -> str:
    return f"{origin(request)}/mcp/"


@router.get("/.well-known/oauth-protected-resource")
@router.get("/.well-known/oauth-protected-resource/mcp")
async def protected_resource_metadata(request: Request):
    base = origin(request)
    return {
        "resource": resource_url(request),
        "authorization_servers": [base],
        "scopes_supported": ["relay"],
        "bearer_methods_supported": ["header"],
        "resource_documentation": f"{base}/docs",
    }


@router.get("/.well-known/oauth-authorization-server")
async def authorization_server_metadata(request: Request):
    base = origin(request)
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "authorization_response_iss_parameter_supported": False,
        "client_id_metadata_document_supported": False,
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["relay"],
    }


class ClientRegistration(BaseModel):
    client_name: str = Field(default="MCP client", max_length=255)
    redirect_uris: list[str] = Field(min_length=1, max_length=10)
    grant_types: list[str] = ["authorization_code"]
    response_types: list[str] = ["code"]
    scope: str | None = None
    token_endpoint_auth_method: str = "none"


@router.post("/oauth/register")
async def register_client(payload: ClientRegistration, db: AsyncSession = Depends(get_db)):
    if payload.grant_types != ["authorization_code"] or payload.response_types != ["code"]:
        raise HTTPException(status_code=400, detail="Only authorization_code is supported")
    if payload.token_endpoint_auth_method != "none":
        raise HTTPException(status_code=400, detail="Only public PKCE clients are supported")
    for uri in payload.redirect_uris:
        parsed = urlparse(uri)
        if parsed.scheme not in {"https", "http"} or not parsed.netloc:
            raise HTTPException(status_code=400, detail="redirect_uris must be absolute HTTP(S) URLs")
    client_id = random_id("relay_client")
    client_id_issued_at = int(datetime.now(timezone.utc).timestamp())
    db.add(OAuthClient(
        client_id=client_id,
        client_name=payload.client_name,
        redirect_uris=payload.redirect_uris,
        token_endpoint_auth_method="none",
    ))
    await db.commit()
    return {
        "client_id": client_id,
        "client_id_issued_at": client_id_issued_at,
        "client_name": payload.client_name,
        "redirect_uris": payload.redirect_uris,
        "grant_types": ["authorization_code"],
        "response_types": ["code"],
        "scope": payload.scope or "relay",
        "token_endpoint_auth_method": "none",
    }


@router.get("/oauth/authorize", response_class=HTMLResponse)
async def authorize_page(
    request: Request,
    response_type: str,
    client_id: str,
    redirect_uri: str,
    code_challenge: str,
    code_challenge_method: str = "S256",
    state: str | None = None,
    scope: str = "relay",
    resource: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(OAuthClient, client_id)
    if response_type != "code" or not client or redirect_uri not in client.redirect_uris:
        raise HTTPException(status_code=400, detail="Invalid OAuth authorization request")
    if (
        not code_challenge
        or code_challenge_method != "S256"
        or normalize_resource(resource) != normalize_resource(resource_url(request))
    ):
        raise HTTPException(status_code=400, detail="PKCE and resource are required")
    hidden = "".join(
        f'<input type="hidden" name="{escape(key)}" value="{escape(value)}">'
        for key, value in {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
            "state": state or "",
            "scope": scope,
            "resource": resource,
        }.items()
    )
    return f"""<!doctype html><html><head><title>Authorize Relay CRM</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{{font:16px system-ui;max-width:480px;margin:12vh auto;padding:24px;color:#172013}}
main{{border:1px solid #dfe8d3;border-radius:16px;padding:28px;box-shadow:0 12px 30px #17201312}}
h1{{font-size:24px}}p{{color:#65725b;line-height:1.5}}button{{background:#587428;color:#fff;border:0;border-radius:9px;padding:12px 18px;font-weight:700;cursor:pointer}}</style>
</head><body><main><h1>Connect Relay CRM</h1>
<p><b>{escape(client.client_name)}</b> wants to use Relay CRM tools for accounts, sequences, and approved handoffs.</p>
<p>Relay will only act on requests you approve through the connected client.</p>
<form method="post" action="/oauth/authorize">{hidden}<button type="submit">Approve connection</button></form>
</main></body></html>"""


@router.post("/oauth/authorize")
async def authorize(
    request: Request,
    client_id: str = Form(...),
    redirect_uri: str = Form(...),
    code_challenge: str = Form(...),
    code_challenge_method: str = Form("S256"),
    resource: str = Form(...),
    state: str | None = Form(None),
    scope: str = Form("relay"),
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(OAuthClient, client_id)
    if (
        not client
        or redirect_uri not in client.redirect_uris
        or code_challenge_method != "S256"
        or normalize_resource(resource) != normalize_resource(resource_url(request))
    ):
        raise HTTPException(status_code=400, detail="Invalid OAuth authorization request")
    raw_code = random_id("relay_code")
    db.add(OAuthAuthorizationCode(
        code_hash=hash_value(raw_code),
        client_id=client_id,
        redirect_uri=redirect_uri,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        resource=resource,
        scope=scope,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    ))
    await db.commit()
    return RedirectResponse(redirect_with_code(redirect_uri, raw_code, state), status_code=status.HTTP_303_SEE_OTHER)


@router.post("/oauth/token")
async def token(
    request: Request,
    grant_type: str = Form(...),
    code: str = Form(...),
    redirect_uri: str = Form(...),
    client_id: str = Form(...),
    code_verifier: str = Form(...),
    resource: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    if grant_type != "authorization_code":
        raise HTTPException(status_code=400, detail="Unsupported grant_type")
    result = await db.execute(select(OAuthAuthorizationCode).where(
        OAuthAuthorizationCode.code_hash == hash_value(code),
        OAuthAuthorizationCode.client_id == client_id,
    ))
    record = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    expires_at = record.expires_at.replace(tzinfo=timezone.utc) if record and record.expires_at.tzinfo is None else record.expires_at if record else None
    if (
        not record
        or expires_at <= now
        or record.redirect_uri != redirect_uri
        or (resource is not None and normalize_resource(resource) != normalize_resource(record.resource))
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired authorization code")
    if not pkce_valid(code_verifier, record.code_challenge, record.code_challenge_method):
        raise HTTPException(status_code=400, detail="PKCE verification failed")
    await db.delete(record)
    await db.commit()
    return {
        "access_token": create_access_token(client_id, record.resource, record.scope),
        "token_type": "Bearer",
        "expires_in": 3600,
        "scope": record.scope or "",
    }
