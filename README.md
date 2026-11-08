# Relay CRM

> AI-native CRM built for founder-led B2B outbound workflows.
> Developed for **Ship Happens Hackathon (Seldon / San Francisco)**.
> Features a full-stack architecture: a reactive UI + an AI-native backend API ready for deployment to **Render.com**.

---

**Current app entry points:** `npm run dev` starts the Vite CRM; `npm run server` starts its TypeScript AI/API service. The older FastAPI, Render, sample-data, and demo API notes later in this file describe legacy backend code and are not the authenticated Vite workspace.

## 🚀 Overview

Relay turns lead lists into persistent customer records, tailored outreach plans, and human approval checkpoints, then continuously keeps records updated as conversations and replies happen.

### Core Demonstrated Loop:
1. **Import:** Parse CSV leads into linked **Account**, **Contact**, and **Deal** records.
2. **Account Brief:** AI-generated account synthesis with strict fact source labels (`user-provided`, `source-linked`, `inference`).
3. **Workflow Plan:** 3-step email outreach sequence with rationale, timing (`delay_days`), and editable drafts.
4. **Approval Queue:** Human approval checkpoint (`approved` / `rejected`) that records state and immutable audit activity without claiming fake external delivery.
5. **Inbound Update & Warm Handoff:** Prospect replies or call notes trigger sentiment/intent parsing, propose stage transitions, record audit history, and create high-priority tasks in the **Handoff Queue**.
6. **Wren QA:** Built-in verification endpoints for **Workflow A (Import & Prepare)** and **Workflow B (Update & Handoff)**.

---

## 🏗️ Repository Architecture

- **Frontend (`src/`):** TypeScript + Vite UI with shared contracts ([`src/shared/contracts.ts`](src/shared/contracts.ts)).
- **Backend API (`backend/`):** FastAPI + SQLAlchemy (Async) + Pydantic v2 supporting both snake_case and camelCase contracts.
  - `backend/app/` — Application routers, DB models, schemas, and AI services.
  - `backend/tests/` — Pytest test suite covering all CRM operations, sequences, and Wren QA.
  - `backend/sample_data/` — Synthetic B2B outbound lead fixtures.
- **Render Deployment (`render.yaml`, `backend/Dockerfile`, `backend/Procfile`):** Ready for one-click deployment as a Render Web Service.

---

## 📡 Backend API Reference

### 1. Health & Wren Proof
- `GET /health` or `GET /api/health` — Service health check.
- `GET /api/qa/status` — System readiness and record counts for Wren evaluation.
- `GET /api/qa/verify-import` — Executes and verifies **Wren Workflow A** (CSV Import → Records → Brief → Sequence).
- `GET /api/qa/verify-handoff` — Executes and verifies **Wren Workflow B** (Inbound reply → Deal stage progression → Activity → Handoff task).

### 2. Lead Import & Sample
- `GET /api/import/sample` — Download sample B2B outbound CSV (`sample_leads.csv`).
- `POST /api/import/preview` — Validate CSV file or raw `csv_text` and preview parsed leads.
- `POST /api/import` — Ingest CSV file (multipart) or JSON `csv_text` / `leads` into linked Accounts, Contacts, Deals, and Activity logs.

### 3. CRM Records & Timeline
- `GET /api/accounts` — List/search accounts (`?query=FinScale`).
- `GET /api/accounts/{id}` — Full account detail with linked contacts, deals, activities, sequences, and handoffs.
- `POST /api/accounts` — Create account.
- `PATCH /api/accounts/{id}` — Update account fields.
- `GET /api/contacts` — List contacts (`?account_id={id}`).
- `GET /api/deals` — List deals (`?stage=Prospecting`).
- `PATCH /api/deals/{id}` — Update deal stage / value. Stage transitions automatically log immutable Activities.
- `GET /api/activities` — Retrieve immutable audit trail (`?account_id={id}`).
- `GET /api/handoffs` — Retrieve warm lead follow-up queue (`?status=pending`).
- `PATCH /api/handoffs/{id}` — Complete or dismiss handoff task.

### 4. AI Workflows & Approvals
- `POST /api/enrich` — Generate structured account brief with labeled facts (`user-provided`, `source-linked`, `inference`).
- `POST /api/sequence` — Generate personalized 3-step email sequence draft (`status: pending`).
- `PATCH /api/sequence/{seq_id}/steps/{step_id}` — Edit draft email step before approval.
- `POST /api/sequence/{seq_id}/approve` — Approve sequence, transition deal to `Outreach`, log activity.
- `POST /api/sequence/{seq_id}/reject` — Reject sequence with reason.

### 5. Inbound Interactions & Handoffs
- `POST /api/interactions` — Analyze simulated prospect reply or meeting note. Returns detected sentiment, intent, proposed stage change, quote, and handoff task.
- `POST /api/interactions/confirm` — Confirm changes, updating Deal stage, logging audit activity, and creating Handoff task.

### 6. Demo Management
- `POST /api/reset?seed=true` — One-click reset to clean seeded demo state (crucial for 90s pitch & Wren runs).
- `GET /api/demo-data` — Overview of pre-configured demo companies.

---

### API Documentation
- Next.js documentation UI: `/docs`.
- FastAPI interactive reference: `/docs` on the API service (also available through `/documentation` and `/introduction`).
- The documentation uses HTTP request examples rather than claiming unsupported official SDKs. TypeScript, Python, and cURL are the recommended starting points; any language with an HTTP client can call the API.

### MCP adapter
Relay includes a complete MCP adapter in `backend/app/mcp_server.py`. It exposes the existing API without duplicating CRM logic:

| MCP surface | Coverage |
|---|---|
| Tools | Accounts, contacts, deals, activities, handoffs, CSV preview/import, briefs, sequences, interaction analysis/confirmation, demo reset/seed, and both QA workflows |
| Resources | `relay://openapi` for the live OpenAPI schema and `relay://documentation` for integration guidance |
| Prompts | `prepare_outreach`, `process_reply`, and `run_demo_proof` |
| Transports | stdio for desktop clients, Streamable HTTP at `/mcp`, and SSE |

Run stdio locally after installing backend requirements:
```bash
RELAY_API_BASE_URL=http://localhost:8787 \
  .venv/bin/python backend/app/mcp_server.py
```

Run a network MCP server:
```bash
MCP_TRANSPORT=streamable-http \
MCP_HOST=0.0.0.0 \
MCP_PORT=8000 \
RELAY_API_BASE_URL=https://relay-crm-api.onrender.com \
  .venv/bin/python backend/app/mcp_server.py
```
The MCP endpoint is then `https://your-mcp-host.example.com/mcp/`. The existing Render service also exposes the legacy SSE transport at `/mcp-legacy/sse`; use it only for clients that do not support Streamable HTTP.

For Cursor, use a local stdio configuration:
```json
{
  "mcpServers": {
    "relay-crm": {
      "command": "/absolute/path/to/.venv/bin/python",
      "args": ["/absolute/path/to/backend/app/mcp_server.py"],
      "env": {
        "RELAY_API_BASE_URL": "https://relay-crm-api.onrender.com"
      }
    }
  }
}
```

`MCP_AUTH_TOKEN` protects the remote MCP mount with `Authorization: Bearer <token>`. Generate it locally with `openssl rand -hex 32`, then add it as a secret environment variable in Render. The current public CRM API remains unchanged; do not expose the MCP URL without this token. The adapter intentionally keeps proposal and mutation steps separate: agents can analyze, but approvals and CRM changes require an explicit user action.

If you use a custom domain, add its hostname to `MCP_ALLOWED_HOSTS` in Render. The default allowlist includes the deployed Render hostname and local development hosts.

## 💻 Local Setup

### GitHub Pages frontend
The existing Next.js landing page and the full Relay API documentation page are exported without a design rewrite and deployed automatically from `main`:

- Landing: `https://rohit-ats.github.io/Relay-CRM/`
- Documentation: `https://rohit-ats.github.io/Relay-CRM/docs/`

The workflow is in `.github/workflows/deploy-pages.yml`. In the repository settings, enable **Pages → Source: GitHub Actions** once; subsequent pushes to `main` deploy both routes automatically. The deployed frontend calls the existing Render API for the live documentation playground.

### Running the Backend API
```bash
# Navigate to backend
cd backend

# Create virtual environment and install dependencies
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt

# Run the API server
uvicorn app.main:app --reload --port 8000
```
Swagger API docs available at: `http://localhost:8000/docs`

### Running the Test Suite
```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Running the Frontend UI
```bash
npm install
npm run dev:full
```

This starts the FastAPI backend on port `8000` and the existing Next.js landing/workspace UI on port `3000`.

---

## 🚢 Deploying to Render

This repository is pre-configured with `render.yaml`, `Dockerfile`, and `Procfile`.

### Option A: Render Blueprint (One-click)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect the `Relay-CRM` repository.
4. Render will automatically detect `render.yaml` and configure the Web Service.
5. Click **Apply**.

### Option B: Web Service Manual Setup
1. Click **New +** → **Web Service**.
2. Connect `Relay-CRM`.
3. Set the following parameters:
   - **Environment:** `Python`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
   - `ENVIRONMENT`: `production`
   - `CORS_ORIGINS`: `*`
   - `ANTHROPIC_API_KEY`: *(Optional - high-quality deterministic fallback is used if omitted)*
   - `OPENAI_API_KEY`: *(Optional)*
5. Click **Deploy Web Service**.

---

## 🧪 Wren Verification Guide

During judging, Wren tests can be run against either your local instance or the deployed Render URL:

1. **Workflow A: Import & Prepare**
   - Call `GET /api/qa/verify-import`
   - Verifies CSV ingestion, record creation, fact-labeled brief, and tailored 3-step sequence.

2. **Workflow B: Update & Handoff**
   - Call `GET /api/qa/verify-handoff`
   - Verifies prospect reply analysis, stage transition to `Demo Scheduled`, immutable audit timeline entry, and warm sales handoff creation.

Open `http://localhost:3000` after running `npm run dev:full`. Do not run `cd Relay-CRM` if PowerShell is already in the repository directory.

The backend uses the provider settings in `backend/.env.example`; if provider credentials are absent, it uses its deterministic fallback. No sequence proposal is sent externally.

## Relay workspace

The existing landing page is preserved. The Vite CRM requires Supabase email and password authentication; there is no local demo workspace and the CRM starts empty until real records are imported. The workspace uses Supabase Postgres as its source of truth and Realtime subscriptions for account, contact, deal, activity, sequence, approval, handoff, and agent-run changes.

Import a real CSV in **Accounts**. Add `linkedin_url` to the header to retain a supplied public profile URL. In **Automations**, Relay runs Google Search grounded research and then creates an editable, Zod-validated outreach draft. The research facts carry source links. Sequence approval records a human decision only; it does not send a message. A reply or call note is analyzed by the CRM Steward and CRM changes are applied only after confirmation.

The Workflows page displays research → personalized plan → approval → delivery readiness on a dotted-grid canvas. Users can add/reorder steps; graphs are workspace-scoped and synced through Realtime. Autonomous outbound execution is not enabled.

## Gemini + Supabase

The server uses the official `@google/genai` SDK. It does not return deterministic output when Gemini is missing or fails. Lead research enables Gemini Google Search grounding and requires verifiable source chunks; failures are shown in the workspace. See [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search?hl=en) and [Gemini model IDs](https://ai.google.dev/gemini-api/docs/models?hl=en).

CRM RLS requires a signed-in user with workspace membership. The browser uses only the Supabase publishable key and the user's Auth session. Keep `SUPABASE_SECRET_KEY`, Gemini, and LinkedIn credentials server-side. The checked-in migrations include workspace tables, RLS, LinkedIn token storage, membership backfill, authenticated grants, and Realtime source/sequence tables.

1. In the repo-root `.env.local`, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` from the Supabase project's API settings. Keep any secret key only in `SUPABASE_SECRET_KEY`.
2. Add `GEMINI_API_KEY` from Google AI Studio and keep `GEMINI_MODEL=gemini-3.8-flash` (or a model currently enabled for your project). Google Search grounding may be billed per search query.
3. Apply migrations with `npx supabase link --project-ref <your-project-ref>` and `npx supabase db push --linked`. Migrations `202611070005_realtime_contacts_and_sources.sql` through `202611070007_sequence_channel_types.sql` have been applied to Relay's linked project.
4. In Supabase **Authentication → URL Configuration**, add `http://localhost:5173/settings` to Redirect URLs. Turn on email/password auth. If email confirmations are enabled, confirm your account before password sign-in.
5. Run `npm run dev` and `npm run server` in separate terminals from the repo root. The TypeScript server loads root `.env.local` itself. Restart both after editing variables.

Google Search grounding provides sourced public web research, not privileged access to LinkedIn profiles. An imported person's name or URL is a search query; the app must treat identity matches and LinkedIn activity as uncertain unless sources directly support them.

## LinkedIn integration

The **Integrations** page connects a signed-in Relay workspace to LinkedIn with the member's consent. It currently supports read-only company organization lookup by LinkedIn page vanity name through the Community Management API. It does not search arbitrary people, post content, or send messages. Results are returned with a LinkedIn source label; LinkedIn may limit fields when the member is not an administrator of that organization. Gmail is shown as **Coming soon**.

### Set up LinkedIn OAuth

1. In the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps), select your app and confirm the **Community Management API** product is approved. In the app's Auth tab, confirm `rw_organization_admin` is available. The Relay flow also requests OpenID scopes `openid profile email` so it can show which LinkedIn member connected.
2. Add this exact **Authorized redirect URL** in the LinkedIn app (adjust host/port only if your local API uses different values): `http://localhost:8787/api/integrations/linkedin/callback`.
3. In repo-root `.env.local`, set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_REDIRECT_URI` to your app values. Keep the client secret server-side. Set `LINKEDIN_SCOPES=openid profile email rw_organization_admin` only if those scopes are listed for your app.
4. The token is encrypted at rest. Generate `LINKEDIN_TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32` and `LINKEDIN_OAUTH_STATE_SECRET` with `openssl rand -hex 32`. Add both to `.env.local`. Also set `SUPABASE_SECRET_KEY` to the project's server-only secret key; never prefix it with `VITE_` or put it in client code. `RELAY_APP_URL` defaults to `http://localhost:5173`.
5. Apply the token-storage migration: `npx supabase db push --linked`. It creates `public.linkedin_connections` with RLS enabled and no browser policies.
6. Start both processes from the repo root. Terminal 1: `set -a; source .env.local; set +a; npm run server`. Terminal 2: `npm run dev`. Sign in to Relay's Supabase workspace, open **Integrations**, and click **Connect LinkedIn**.
7. After consent, enter a company-page vanity name from its LinkedIn URL (for example, `linkedin`) to run an Organization Lookup. API calls include LinkedIn's monthly `Linkedin-Version` header; update `LINKEDIN_API_VERSION` from LinkedIn's current versioning docs when you upgrade.

Relay stores the LinkedIn access token encrypted in Supabase and exposes only connection metadata to the browser. LinkedIn tokens expire; reconnect from Integrations when prompted. Disconnecting removes the stored Relay token. LinkedIn may also need to be removed from the member's authorized apps to revoke the grant itself.
