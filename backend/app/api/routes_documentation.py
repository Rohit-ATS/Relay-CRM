from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["Documentation"])

DOCUMENTATION_REDIRECT = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Relay CRM API documentation</title>
  </head>
  <body>
    <h1>Relay CRM API documentation</h1>
    <p>
      Use the interactive
      <a href="/docs">Swagger API reference</a>
      or download the <a href="/openapi.json">OpenAPI schema</a>.
    </p>
  </body>
</html>"""


@router.get("/documentation", response_class=HTMLResponse)
@router.get("/docs-intro", response_class=HTMLResponse)
@router.get("/introduction", response_class=HTMLResponse)
async def get_documentation() -> HTMLResponse:
    return HTMLResponse(content=DOCUMENTATION_REDIRECT, status_code=200)
