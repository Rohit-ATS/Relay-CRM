from fastapi import APIRouter
from fastapi.responses import RedirectResponse

router = APIRouter(tags=["Documentation"])


@router.get("/documentation")
@router.get("/docs-intro")
@router.get("/introduction")
async def get_documentation() -> RedirectResponse:
    """Redirect legacy documentation URLs to the primary documentation page."""
    return RedirectResponse(url="/docs", status_code=302)
