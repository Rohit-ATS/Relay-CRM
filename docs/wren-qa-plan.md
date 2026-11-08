# Wren QA plan for Relay

Wren is Seldon's browser-based behavioral QA agent. Run these checks from the Wren app against a browser-accessible Relay deployment. The test descriptions are plain-language run instructions; they do not require a Relay-side Wren API integration.

## Before running

- Use a deployment built from the commit you intend to judge. A local `localhost` URL is only reachable if Wren can access that machine or a temporary, authenticated tunnel is provided.
- Sign in with a dedicated Relay test workspace account and confirm the correct workspace is open.
- Use only the real CSV, reply, or call note supplied for the run. If no real input is available, mark the scenario blocked; do not substitute bundled sample data or invent a prospect response.
- Do not use Reset demo data, bundled sample leads, canned replies, or seeded records in a real-data run.
- Do not click any action that sends email or LinkedIn messages. Relay currently prepares plans for approval and does not deliver them.
- Do not approve all, delete records, or change account/deal fields unless the test owner has supplied the exact record and desired action.

## Run A — import and inspect a real lead

**Wren instruction**

> In the signed-in Relay workspace, import the supplied real lead CSV. Verify that each imported row produces the expected account, contact, and deal records, with their relationships intact. Open one imported account and inspect its contact, deal, source information, and activity history. Open its workflow/outreach plan. Confirm the plan is visibly a draft awaiting human review, that research claims show their sources, and that no message is shown as sent. Do not approve the plan or send anything. Capture the import result, account detail, and plan state as run evidence. If the app reports an error or any expected record is missing, stop and report the visible error and affected row.

**Evidence to retain**

- Wren run ID and timestamp
- Screenshot/recording of the completed import confirmation
- Account name and visible account/contact/deal relationship
- Source labels and sequence approval state
- Any visible errors, with their steps to reproduce

## Run B — verify a real interaction and handoff

**Wren instruction**

> In the signed-in Relay workspace, open the account named by the test owner and verify its existing CRM details and activity timeline. Using only the actual prospect reply or call note supplied for this run, enter the interaction through the Relay UI and inspect the proposed CRM update. Confirm that the proposal cites the supplied interaction, then approve only the explicitly requested change. Verify the resulting account/deal fields, the new timeline entry, and the handoff task in the UI. Do not invent a reply, use a canned example, or send an outbound message. If no real interaction was supplied, stop before submitting and mark this workflow blocked for missing input.

**Evidence to retain**

- Wren run ID and timestamp
- Screenshot/recording of the actual supplied interaction and its pending proposal
- The approved field change, account/deal value before and after, timeline entry, and handoff task
- Any visible errors, with their steps to reproduce

## Reporting

Report each workflow as **Pass**, **Fail**, or **Blocked**. A pass requires Wren's recorded browser evidence to show the expected UI/data. API responses, seeded fixtures, a successful build, and Relay's legacy `/api/qa/verify-*` endpoints do not count as Wren results. Keep screenshots and recordings in Wren's run artifacts; do not commit workspace credentials, API keys, prospect data, or private evidence to this repository.

## Connect Seldon MCP to Codex

Seldon's hosted MCP exposes tools for Codex to validate and edit `seldon.yml`, start browser QA runs, and retrieve reports and evidence. It is a QA client connection; Relay's application server does not call this MCP or need a `WREN_API_KEY`.

1. Make the Seldon API key available to the shell that launches Codex, without putting it in the repository or browser environment:

   ```bash
   export SELDON_API_KEY='seldon_…'
   ```

2. Register the hosted Streamable HTTP server. Seldon accepts a bearer token, so Codex can read the key from the environment variable:

   ```bash
   codex mcp add seldon --url https://app.seldon.com/mcp --bearer-token-env-var SELDON_API_KEY
   codex mcp list
   ```

3. Restart the Codex session so it discovers the server tools. Ask Codex to create or validate the Relay baseline, run it against a browser-accessible deployment, and retrieve both the summary and per-case report. The Wren/Seldon MCP tools are not available in a session until the MCP server is configured and loaded.

The API key authenticates access to Seldon and stays outside the app. Relay still needs an accessible signed-in workspace for browser tests. Treat Wren's captured run artifacts as QA evidence; a successful MCP connection alone is not a pass. Seldon's MCP documentation: [Connect to the Seldon MCP server](https://app.seldon.com/docs/developers/connect-mcp).
