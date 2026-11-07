from contextlib import AsyncExitStack, asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.session import init_db, async_session_maker
from app.services.crm_service import crm_service
from app.api.routes_accounts import router as accounts_router
from app.api.routes_contacts import router as contacts_router
from app.api.routes_deals import router as deals_router
from app.api.routes_activities import router as activities_router
from app.api.routes_handoffs import router as handoffs_router
from app.api.routes_import import router as import_router
from app.api.routes_enrich import router as enrich_router
from app.api.routes_sequence import router as sequence_router
from app.api.routes_interactions import router as interactions_router
from app.api.routes_demo import router as demo_router
from app.api.routes_qa import router as qa_router
from app.api.routes_documentation import router as documentation_router
from app.api.routes_oauth import router as oauth_router
from app.mcp_auth import MCPBearerAuthMiddleware
from app.mcp_server import mcp

mcp_http_asgi = mcp.streamable_http_app()
mcp_sse_asgi = mcp.sse_app()
mcp_http_app = MCPBearerAuthMiddleware(mcp_http_asgi, settings.MCP_AUTH_TOKEN)
mcp_sse_app = MCPBearerAuthMiddleware(mcp_sse_asgi, settings.MCP_AUTH_TOKEN)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(mcp_http_asgi.router.lifespan_context(mcp_http_asgi))

        # Initialize database tables
        await init_db()

        # Check if DB is empty; if so, populate initial seed data for immediate usability
        async with async_session_maker() as session:
            existing = await crm_service.list_accounts(session, limit=1)
            if not existing:
                await crm_service.reset_database(session, seed=True)

        yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(accounts_router)
app.include_router(contacts_router)
app.include_router(deals_router)
app.include_router(activities_router)
app.include_router(handoffs_router)
app.include_router(import_router)
app.include_router(enrich_router)
app.include_router(sequence_router)
app.include_router(interactions_router)
app.include_router(demo_router)
app.include_router(qa_router)
app.include_router(documentation_router)
app.include_router(oauth_router)

# The MCP adapter is mounted on the existing Render service so it shares the
# deployed API URL. It is protected independently from the public CRM API.
app.mount("/mcp", mcp_http_app)
app.mount("/mcp-legacy", mcp_sse_app)


@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health_check():
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT
        }
    )
