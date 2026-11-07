# Relay CRM

AI-native CRM demo for founder-led sales. The demo supports CSV import, linked account/contact/deal records, an editable outreach plan, human approval, simulated prospect interactions, an activity timeline, and a handoff queue. Simulated interactions are never sent externally.

## Run locally

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app works without credentials and saves the demo workspace in browser local storage. Use **Reset demo workspace** in the sidebar to restore fixtures.

## Optional AI draft generation

Copy `.env.example` to `.env.local` and add `ANTHROPIC_API_KEY`. The key is read only by the `/api/sequence` server route. Set `ANTHROPIC_MODEL` if you need a different model. If the key is missing, unavailable, or returns invalid JSON, Relay uses the deterministic demo sequence. Sequence output is validated with Zod before it is returned.

## Screens

- `/` — Relay landing page with a workspace preview and demo entry points
- `/workspace` — Accounts and pipeline, sample CSV download, import preview
- `/accounts/[id]` — Account record, contact, opportunity, timeline, simulated interaction
- `/review` — Editable outreach sequence and human approval
- `/handoffs` — Human follow-up queue

The browser stores the single-user demo state in local storage. Route handlers validate workflow payloads and generate sequence/interaction proposals; no external email delivery is implemented.
