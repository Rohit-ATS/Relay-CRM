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
- **Backend API (`app/`):** FastAPI + SQLAlchemy (Async) + Pydantic v2 supporting both snake_case and camelCase contracts.
- **Tests (`tests/`):** Pytest test suite testing all CRM endpoints, AI sequences, inbound interactions, and Wren workflows.
- **Render Deployment (`render.yaml`, `Dockerfile`, `Procfile`):** Ready for one-click deployment as a Render Web Service.

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

## 💻 Local Setup

### Running the Backend API
```bash
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
source .venv/bin/activate
pytest -v
```

### Running the Frontend UI
```bash
npm install
npm run server
```

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

In a second terminal, run `npm run dev` and open the local URL printed by Vite. The Vite dev server proxies `/api/sequence` to the server on port `8787`.

The sequence workflow reads `RELAY_AI_API_URL`, `RELAY_AI_API_KEY`, and `RELAY_AI_MODEL` only in `server/`. If the optional provider variables are absent or the provider fails, the API returns a clearly labeled deterministic demo fixture. No sequence proposal is persisted or sent.
