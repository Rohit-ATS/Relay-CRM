import secrets
from collections.abc import Callable
from app.oauth import verify_access_token


class MCPBearerAuthMiddleware:
    """Protect the mounted MCP ASGI app with static or OAuth bearer tokens."""

    def __init__(self, app: Callable, token: str | None):
        self.app = app
        self.token = token

    async def __call__(self, scope, receive, send):
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        authorization = headers.get("authorization", "")
        auth_scheme, _, supplied_token = authorization.partition(" ")
        supplied_token = supplied_token.strip()
        valid_static = (
            auth_scheme.lower() == "bearer"
            and self.token is not None
            and secrets.compare_digest(supplied_token, self.token)
        )
        scheme = headers.get("x-forwarded-proto", scope.get("scheme", "https")).split(",")[0].strip()
        host = headers.get("host", "")
        resource = f"{scheme}://{host}/mcp/"
        valid_oauth = auth_scheme.lower() == "bearer" and verify_access_token(supplied_token, resource)
        if not (valid_static or valid_oauth):
            metadata_url = f"{scheme}://{host}/.well-known/oauth-protected-resource"
            await self._error(send, 401, "Valid MCP bearer token required.", metadata_url)
            return

        await self.app(scope, receive, send)

    @staticmethod
    async def _error(send, status_code: int, message: str, resource: str | None = None):
        body = f'{{"detail":"{message}"}}'.encode()
        challenge = "Bearer"
        if resource:
            challenge += f' resource_metadata="{resource}" scope="relay"'
        await send({
            "type": "http.response.start",
            "status": status_code,
            "headers": [
                (b"content-type", b"application/json"),
                (b"www-authenticate", challenge.encode()),
            ],
        })
        await send({"type": "http.response.body", "body": body})
