import secrets
from collections.abc import Callable


class MCPBearerAuthMiddleware:
    """Protect the mounted MCP ASGI app with a static bearer token."""

    def __init__(self, app: Callable, token: str | None):
        self.app = app
        self.token = token

    async def __call__(self, scope, receive, send):
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return

        if not self.token:
            await self._error(send, 503, "MCP_AUTH_TOKEN is not configured.")
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        authorization = headers.get("authorization", "")
        scheme, _, supplied_token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not secrets.compare_digest(
            supplied_token.strip(), self.token
        ):
            await self._error(send, 401, "Valid MCP bearer token required.")
            return

        await self.app(scope, receive, send)

    @staticmethod
    async def _error(send, status_code: int, message: str):
        body = f'{{"detail":"{message}"}}'.encode()
        await send({
            "type": "http.response.start",
            "status": status_code,
            "headers": [
                (b"content-type", b"application/json"),
                (b"www-authenticate", b"Bearer"),
            ],
        })
        await send({"type": "http.response.body", "body": body})
