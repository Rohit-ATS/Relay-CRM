import "./styles.css";
import { importRows, loadData, resetData, type RelayData } from "./lib/crm-store";
import { parseCsv, sampleCsv, supportedCsvHeaders, type CsvPreview } from "./lib/csv-import";

const app = document.querySelector<HTMLDivElement>("#app")!;
let data: RelayData = loadData();
let preview: CsvPreview | null = null;

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
      <section class="pipeline"><div class="section-heading"><div><p class="eyebrow blue">PIPELINE</p><h2>Accounts</h2></div><span class="count">${data.accounts.length} account${data.accounts.length === 1 ? "" : "s"}</span></div><div class="table-wrap"><table><thead><tr><th>Account</th><th>Contact</th><th>Deal</th><th>Stage</th><th>Value</th><th>Next step</th></tr></thead><tbody>${data.accounts.map((account) => { const contact = contactsByAccount.get(account.id); const deal = dealsByAccount.get(account.id); return `<tr><td><strong>${escapeHtml(account.companyName)}</strong><span class="cell-sub">${escapeHtml(account.domain) || "No domain"}</span></td><td>${escapeHtml(contact?.name)}<span class="cell-sub">${escapeHtml(contact?.title)}</span></td><td>${escapeHtml(deal?.name)}</td><td><span class="stage ${deal?.stage ?? ""}">${escapeHtml(deal?.stage)}</span></td><td>${money(deal?.value)}</td><td>${escapeHtml(deal?.nextStep) || "—"}</td></tr>`; }).join("")}</tbody></table></div></section>
    </main>`;
  bindEvents();
  if (preview) renderPreview(preview);
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
}

render();
