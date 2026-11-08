import base64
import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import urlencode

from app.core.config import settings


def _secret() -> bytes:
    secret = settings.OAUTH_SIGNING_SECRET or settings.MCP_AUTH_TOKEN or "relay-crm-default-oauth-signing-secret-key-2026"
    return secret.encode()


def hash_value(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def normalize_resource(resource: str | None) -> str:
    return resource.rstrip("/") if resource else ""


def random_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(24)}"


def create_access_token(client_id: str, resource: str, scope: str | None) -> str:
    payload = {
        "iss": "relay-crm",
        "sub": client_id,
        "aud": resource,
        "scope": scope or "",
        "typ": "access",
        "exp": int(time.time()) + 3600,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).rstrip(b"=").decode()
    signature = hmac.new(_secret(), encoded.encode(), hashlib.sha256).digest()
    return f"{encoded}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def create_refresh_token(client_id: str, resource: str, scope: str | None) -> str:
    payload = {
        "iss": "relay-crm",
        "sub": client_id,
        "aud": resource,
        "scope": scope or "",
        "typ": "refresh",
        "exp": int(time.time()) + 30 * 86400,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).rstrip(b"=").decode()
    signature = hmac.new(_secret(), encoded.encode(), hashlib.sha256).digest()
    return f"{encoded}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def verify_access_token(token: str, resource: str) -> bool:
    try:
        encoded, supplied_signature = token.split(".", 1)
        expected = hmac.new(_secret(), encoded.encode(), hashlib.sha256).digest()
        signature = base64.urlsafe_b64decode(supplied_signature + "=" * (-len(supplied_signature) % 4))
        if not hmac.compare_digest(signature, expected):
            return False
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        return normalize_resource(payload.get("aud", "")) == normalize_resource(resource) and payload.get("exp", 0) > time.time()
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, RuntimeError):
        return False


def verify_refresh_token(token: str) -> dict | None:
    try:
        encoded, supplied_signature = token.split(".", 1)
        expected = hmac.new(_secret(), encoded.encode(), hashlib.sha256).digest()
        signature = base64.urlsafe_b64decode(supplied_signature + "=" * (-len(supplied_signature) % 4))
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if payload.get("typ") != "refresh" or payload.get("exp", 0) <= time.time():
            return None
        return payload
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, RuntimeError):
        return None


def pkce_valid(verifier: str, challenge: str, method: str) -> bool:
    if method != "S256":
        return False
    digest = hashlib.sha256(verifier.encode()).digest()
    encoded = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return hmac.compare_digest(encoded, challenge)


def redirect_with_code(redirect_uri: str, code: str, state: str | None) -> str:
    params = {"code": code}
    if state:
        params["state"] = state
    return f"{redirect_uri}{'&' if '?' in redirect_uri else '?'}{urlencode(params)}"
