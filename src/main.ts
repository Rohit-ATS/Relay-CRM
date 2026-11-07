import "./styles.css";
import { importRows, loadData, resetData, type RelayData } from "./lib/crm-store";
import { parseCsv, sampleCsv, supportedCsvHeaders, type CsvPreview } from "./lib/csv-import";
import type { GeneratedSequenceResult } from "./shared/contracts";

const app = document.querySelector<HTMLDivElement>("#app")!;
let data: RelayData = loadData();
let preview: CsvPreview | null = null;
let sequenceState: { accountId?: string; loading: boolean; error?: string; result?: GeneratedSequenceResult } = { loading: false };

const escapeHtml = (value: string | number | undefined) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]!));
const money = (value?: number) => value === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function render(): void {
  const contactsByAccount = new Map(data.contacts.map((contact) => [contact.accountId, contact]));
  const dealsByAccount = new Map(data.deals.map((deal) => [deal.accountId, deal]));
  app.innerHTML = `
    <main class="shell">
      <header class="topbar"><div><p class="eyebrow">RELAY CRM</p><h1>Accounts & pipeline</h1><p class="subhead">Import a lead list into linked customer records, ready for the next workflow.</p></div><button class="button secondary" id="reset-data">Reset demo data</button></header>
      <section class="import-card" aria-labelledby="import-title">
        <div class="section-heading"><div><p class="eyebrow blue">CSV IMPORT</p><h2 id="import-title">Bring in your lead list</h2><p class="muted">Required columns: ${requiredHeadersMarkup()}</p></div><div class="actions"><button class="button secondary" id="download-sample">Download sample CSV</button><button class="button secondary" id="load-sample">Load sample</button><label class="button primary file-button">Choose CSV<input id="csv-file" type="file" accept=".csv,text/csv" /></label></div></div>
        <div class="dropzone"><textarea id="csv-text" aria-label="CSV preview input" placeholder="Paste CSV here or load the sample..."></textarea><div class="dropzone-copy"><span class="upload-icon">↥</span><strong>Paste CSV or choose a file</strong><span class="muted">Validate headers and rows before anything is saved.</span></div></div>
        <div id="import-status" aria-live="polite"></div>
        <div id="preview"></div>
      </section>
      <section class="pipeline"><div class="section-heading"><div><p class="eyebrow blue">PIPELINE</p><h2>Accounts</h2></div><span class="count">${data.accounts.length} account${data.accounts.length === 1 ? "" : "s"}</span></div><div class="table-wrap"><table><thead><tr><th>Account</th><th>Contact</th><th>Deal</th><th>Stage</th><th>Value</th><th>Next step</th><th></th></tr></thead><tbody>${data.accounts.map((account) => { const contact = contactsByAccount.get(account.id); const deal = dealsByAccount.get(account.id); return `<tr><td><strong>${escapeHtml(account.companyName)}</strong><span class="cell-sub">${escapeHtml(account.domain) || "No domain"}</span></td><td>${escapeHtml(contact?.name)}<span class="cell-sub">${escapeHtml(contact?.title)}</span></td><td>${escapeHtml(deal?.name)}</td><td><span class="stage ${deal?.stage ?? ""}">${escapeHtml(deal?.stage)}</span></td><td>${money(deal?.value)}</td><td>${escapeHtml(deal?.nextStep) || "—"}</td><td><button class="button mini-button" data-generate="${account.id}" ${sequenceState.loading ? "disabled" : ""}>${sequenceState.loading && sequenceState.accountId === account.id ? "Generating…" : "Draft sequence"}</button></td></tr>`; }).join("")}</tbody></table></div>${renderSequencePanel(contactsByAccount)}</section>
    </main>`;
  bindEvents();
  if (preview) renderPreview(preview);
}

function renderSequencePanel(contactsByAccount: Map<string, RelayData["contacts"][number]>): string {
  if (!sequenceState.accountId) return "";
  const account = data.accounts.find((item) => item.id === sequenceState.accountId);
  const contact = account ? contactsByAccount.get(account.id) : undefined;
  if (!account || !contact) return "";
  if (sequenceState.loading) return `<div class="sequence-panel"><div class="spinner"></div><strong>Preparing a 3-step draft for ${escapeHtml(account.companyName)}…</strong><span class="muted">Validating the proposal on the server. Nothing is being sent or saved.</span></div>`;
  if (sequenceState.error) return `<div class="sequence-panel error-panel"><strong>Could not prepare the draft.</strong><span>${escapeHtml(sequenceState.error)}</span><button class="button secondary" id="retry-sequence">Try again</button></div>`;
  if (!sequenceState.result) return "";
  const result = sequenceState.result;
  return `<div class="sequence-panel"><div class="sequence-header"><div><p class="eyebrow blue">OUTREACH PROPOSAL</p><h3>${escapeHtml(account.companyName)} · ${escapeHtml(contact.name)}</h3></div><span class="fixture-badge">${result.mode === "demo_fixture" ? "Demo fixture" : "Provider result"}</span></div><p class="brief">${escapeHtml(result.brief)}</p>${result.fallbackReason ? `<div class="alert error"><strong>Provider fallback:</strong><span>${escapeHtml(result.fallbackReason)}</span></div>` : ""}<div class="fact-list"><strong>Facts used</strong>${result.facts.map((item) => `<span><b>${escapeHtml(item.key)}:</b> ${escapeHtml(item.value)} <em>${escapeHtml(item.source.label ?? item.source.type)}</em></span>`).join("")}</div><div class="steps">${result.steps.map((step, index) => `<article class="step"><span class="step-number">${index + 1}</span><div><span class="delay">Day ${step.delayDays}</span><h4>${escapeHtml(step.subject)}</h4><p>${escapeHtml(step.body).replace(/\n/g, "<br />")}</p><small>${escapeHtml(step.rationale)}</small></div></article>`).join("")}</div><p class="muted note">Proposal only. Review and approve it before any future external action; this workflow does not mutate CRM records.</p></div>`;
}

function requiredHeadersMarkup(): string { return supportedCsvHeaders.slice(0, 3).map((header) => `<code>${header}</code>`).join(", "); }

function renderPreview(nextPreview: CsvPreview): void {
  const target = document.querySelector<HTMLDivElement>("#preview")!;
  const status = document.querySelector<HTMLDivElement>("#import-status")!;
  if (nextPreview.errors.length > 0) {
    status.innerHTML = `<div class="alert error"><strong>Fix ${nextPreview.errors.length} issue${nextPreview.errors.length === 1 ? "" : "s"} before importing.</strong><span>${nextPreview.errors.map((error) => `Row ${error.row}: ${escapeHtml(error.message)}`).join(" · ")}</span></div>`;
  } else if (nextPreview.rows.length > 0) {
    status.innerHTML = `<div class="alert success"><strong>${nextPreview.rows.length} valid row${nextPreview.rows.length === 1 ? "" : "s"} ready.</strong><span>Nothing is saved until you confirm the import.</span></div>`;
  } else {
    status.innerHTML = `<div class="alert error"><strong>No importable rows found.</strong></div>`;
  }
  target.innerHTML = nextPreview.rows.length > 0 ? `<div class="preview-heading"><h3>Import preview</h3><button class="button primary" id="confirm-import" ${nextPreview.errors.length > 0 ? "disabled" : ""}>Import ${nextPreview.rows.length} row${nextPreview.rows.length === 1 ? "" : "s"}</button></div><div class="preview-table"><table><thead><tr><th>Company</th><th>Contact</th><th>Deal</th><th>Stage</th><th>Value</th></tr></thead><tbody>${nextPreview.rows.map((row) => `<tr><td>${escapeHtml(row.company_name)}</td><td>${escapeHtml(row.contact_name)}</td><td>${escapeHtml(row.deal_name)}</td><td>${escapeHtml(row.deal_stage)}</td><td>${money(row.deal_value)}</td></tr>`).join("")}</tbody></table></div>` : "";
  document.querySelector<HTMLButtonElement>("#confirm-import")?.addEventListener("click", () => {
    if (!preview || preview.errors.length > 0) return;
    data = importRows(data, preview.rows);
    preview = null;
    render();
    document.querySelector<HTMLDivElement>("#import-status")!.innerHTML = `<div class="alert success"><strong>Import complete.</strong><span>Linked account, contact, and deal records were saved.</span></div>`;
  });
}

function parseAndPreview(text: string): void {
  (document.querySelector<HTMLTextAreaElement>("#csv-text")!).value = text;
  preview = parseCsv(text);
  renderPreview(preview);
}

function downloadSample(): void {
  const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "relay-sample-leads.csv"; link.click(); URL.revokeObjectURL(url);
}

function bindEvents(): void {
  document.querySelector<HTMLButtonElement>("#reset-data")?.addEventListener("click", () => { data = resetData(); preview = null; render(); });
  document.querySelector<HTMLButtonElement>("#download-sample")?.addEventListener("click", downloadSample);
  document.querySelector<HTMLButtonElement>("#load-sample")?.addEventListener("click", () => parseAndPreview(sampleCsv));
  document.querySelector<HTMLTextAreaElement>("#csv-text")?.addEventListener("input", (event) => parseAndPreview((event.target as HTMLTextAreaElement).value));
  document.querySelector<HTMLInputElement>("#csv-file")?.addEventListener("change", (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseAndPreview(String(reader.result ?? ""));
    reader.onerror = () => { document.querySelector<HTMLDivElement>("#import-status")!.innerHTML = `<div class="alert error"><strong>Could not read that file.</strong></div>`; };
    reader.readAsText(file);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-generate]").forEach((button) => button.addEventListener("click", () => generateSequence(button.dataset.generate!)));
  document.querySelector<HTMLButtonElement>("#retry-sequence")?.addEventListener("click", () => { if (sequenceState.accountId) generateSequence(sequenceState.accountId); });
}

async function generateSequence(accountId: string): Promise<void> {
  const account = data.accounts.find((item) => item.id === accountId);
  const contact = data.contacts.find((item) => item.accountId === accountId);
  if (!account || !contact) return;
  sequenceState = { accountId, loading: true };
  render();
  try {
    const response = await fetch("/api/sequence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account, contact, notes: account.summary ?? "" }) });
    const payload = await response.json() as GeneratedSequenceResult | { error?: string };
    if (!response.ok || "error" in payload) throw new Error((payload as { error?: string }).error ?? "The server returned an error.");
    sequenceState = { accountId, loading: false, result: payload as GeneratedSequenceResult };
  } catch (error) {
    sequenceState = { accountId, loading: false, error: error instanceof Error ? `${error.message} Is the Relay API running on port 8787?` : "The sequence request failed." };
  }
  render();
}

render();
