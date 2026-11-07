# Relay CRM

> AI-native CRM built for founder-led B2B outbound workflows.
> Developed for **Ship Happens Hackathon (Seldon / San Francisco)**.
> Features a full-stack architecture: a reactive UI + an AI-native backend API ready for deployment to **Render.com**.

---

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

## 💻 Local Setup

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

The Vite app opens on the Dashboard at `/` (also `/dashboard` and `/workspace`). Its left navigation includes Action Center, Accounts, Pipeline, People, Tasks, Notes, Reports, Automations, Documentation, Settings, and Log out. Handoffs appear in Dashboard and Tasks; there is no separate Handoff Queue screen.

Pipeline columns use recorded call notes, simulated prospect replies, and deals explicitly marked lost. Sequence approval records a human decision for workflow tracking and never sends an email. AI sequence output is generated server-side and Zod validated; if credentials are absent or the provider fails, Relay returns a labeled deterministic fixture.

For the demo: import sample leads from **Accounts**, inspect/approve plans in **Action Center** (or open **Automations** to review an account-specific plan), log a simulated reply or call note from an account detail, confirm the proposed CRM update, then return to Dashboard to see the changed deal, timeline, and handoff task. **Settings → Reset demo data** restores seeded records in local browser storage.

The screenshot-inspired marketing page is available at `/landing`. The optional Next.js app remains available through `npm run dev:full` or `npm run dev:next`.

## Gemini + Supabase

The existing landing page, Vite workspace, FastAPI API, SQLite demo mode, and deterministic fixtures remain available. The TypeScript API on port `8787` now uses the official `@google/genai` SDK when `GEMINI_API_KEY` is configured; otherwise each agent returns a labeled deterministic fixture. Server prompts live in `server/agents/prompts/`, and output is validated with Zod before returning. The endpoints are `/api/sequence`, `/api/agents/research`, and `/api/agents/steward` through the Vite `/api` proxy. These agents propose data only; they do not send outreach or commit CRM mutations.

The Supabase migration at [`supabase/migrations/202611070001_relay_core.sql`](supabase/migrations/202611070001_relay_core.sql) defines workspace-owned CRM, workflow, approval, and agent-run tables. RLS requires Supabase Auth membership; new Auth users receive a private workspace. Realtime publication includes `agent_runs`, `activities`, `accounts`, `deals`, and `handoff_tasks`. The Vite browser client uses the publishable key plus the signed-in user's Auth session, so database access remains subject to RLS. `SUPABASE_SECRET_KEY` is not used by the app and must never be exposed in browser code.

To configure an actual Supabase project:

1. Put the project URL and publishable key in the repo-root `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Restart Vite after changing the file. Set `GEMINI_API_KEY` separately if you want live Gemini output; otherwise labeled fixtures are used.
2. Apply the checked-in SQL migration with `npx supabase link --project-ref YOUR_PROJECT_REF` and `npx supabase db push --linked`.
3. In Supabase **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173` and add `http://localhost:5173/settings` to Redirect URLs. Email magic-link sign-in is initiated from Relay **Settings**. New users get a private workspace from the migration trigger.
4. Start `npm run dev`. In a second terminal, load the server-only settings and start the Gemini API: `set -a; source .env.local; set +a; npm run server`.
5. In Relay **Settings**, send yourself a sign-in link. If the Supabase workspace is empty, click **Sync local CRM records to Supabase** to initialize it. This explicit action copies the current browser records once; subsequent changes sync automatically. If cloud records already exist, they load into the app. Settings → Reset demo data resets the connected workspace too.

Without Supabase browser credentials or an Auth session, the landing page and local demo workspace continue to work in browser storage. No secrets are checked into this repository.
