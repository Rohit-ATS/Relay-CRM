import "./styles.css";
import "../app/landing.css";
import { importRows, loadData, resetData, type RelayData } from "./lib/crm-store";
import { parseCsv, sampleCsv, supportedCsvHeaders, type CsvPreview } from "./lib/csv-import";

const app = document.querySelector<HTMLDivElement>("#app")!;
let data: RelayData = loadData();
let preview: CsvPreview | null = null;

const escapeHtml = (value: string | number | undefined) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]!));
const money = (value?: number) => value === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function renderLanding(): void {
  app.innerHTML = `
    <main class="landing-page">
      <header class="landing-nav"><a class="landing-logo" href="/"><span>✳</span> relay<span class="orange">.</span></a><nav><a href="#home">Home</a><a href="#features">Features</a><a href="#workflow">Workflow</a><a href="#about">About</a></nav><div class="landing-nav-actions"><a class="landing-login" href="/workspace">Open workspace</a><a class="landing-nav-cta" href="/workspace">Get started <span>↗</span></a></div></header>
      <section class="landing-hero" id="home"><div class="hero-glow"></div><div class="hero-copy"><span class="hero-badge"><i>✦</i> THE CRM THAT MOVES WITH YOUR SALES</span><h1>Close more deals.<br>Grow <em>revenue faster.</em></h1><p>Relay turns your lead list into a living CRM. Prepare thoughtful outreach for approval, then keep every account current as conversations happen.</p><div class="hero-actions"><a href="/workspace" class="hero-primary">Open the demo <span>↗</span></a><a href="#features" class="hero-secondary"><span>↓</span> Explore Relay</a></div><div class="hero-note"><span class="note-avatars"><i>R</i><i>✳</i><i>✓</i></span><span>Built for teams that sell with context.</span></div></div>
        <div class="hero-preview-wrap"><div class="browser-preview"><div class="browser-bar"><div class="browser-dots"><i></i><i></i><i></i></div><div class="browser-url"><span>⌑</span> relay.app / workspace <span>↻</span></div><div class="browser-tools">↗ &nbsp; ▢ &nbsp; ···</div></div><div class="preview-app"><aside class="preview-side"><div class="preview-brand"><span>✳</span> relay<span class="orange">.</span></div><div class="preview-nav active">▦ &nbsp; Pipeline</div><div class="preview-nav">✳ &nbsp; Sequences</div><div class="preview-nav">↗ &nbsp; Handoffs</div><div class="preview-side-note"><b>DEMO WORKSPACE</b><span>Records stay in sync</span></div></aside><div class="preview-content"><div class="preview-top"><span>Accounts / Pipeline</span><span class="preview-user">RC</span></div><div class="preview-title"><div><small>YOUR SALES WORKSPACE</small><b>Accounts &amp; pipeline<span class="orange">.</span></b></div><a class="preview-import" href="/workspace">＋ Import leads</a></div><div class="preview-stats"><div><small>OPEN PIPELINE</small><b>$124,500</b><span>Across 4 opportunities</span></div><div><small>ACTIVE ACCOUNTS</small><b>04</b><span>All records up to date</span></div><div><small>NEEDS REVIEW</small><b>01</b><span>Plan awaiting approval</span></div></div><div class="preview-panels"><div class="preview-table"><div class="fake-table-head">ACCOUNT <span>CONTACT</span><span>STAGE</span><span>VALUE</span></div><div class="fake-row"><i class="fake-avatar c0">NL</i><b>Northstar Labs</b><span>Maya Chen</span><em>Qualified</em><strong>$48,000</strong></div><div class="fake-row"><i class="fake-avatar c1">V</i><b>Vercelity</b><span>Jordan Lee</span><em>Discovery</em><strong>$32,000</strong></div><div class="fake-row"><i class="fake-avatar c2">F</i><b>Formwise</b><span>Alex Morgan</span><em>Prospecting</em><strong>$18,500</strong></div></div><div class="preview-chart"><div class="chart-caption"><b>Pipeline momentum</b><span>Demo snapshot</span></div><div class="chart-number">$124.5k</div><div class="mini-bars"><span style="height:32%"></span><span style="height:47%"></span><span style="height:39%"></span><span style="height:62%"></span><span style="height:48%"></span><span style="height:76%"></span><span style="height:56%"></span><span style="height:85%"></span><span style="height:66%"></span><span class="hot" style="height:98%"></span><span style="height:70%"></span><span style="height:82%"></span></div><div class="chart-months"><span>JUN</span><span>JUL</span><span>AUG</span><span>SEP</span><span>OCT</span><span>NOV</span></div></div></div><div class="preview-bottom"><span><i></i> CRM records stay current</span><span>Next up · Sequence review ↗</span></div></div></div><div class="float-card float-approval"><span class="float-icon">✓</span><div><b>Approval stays human</b><small>Review before anything moves</small></div></div><div class="float-card float-update"><span class="float-spark">✳</span><div><b>CRM updated</b><small>Reply → engaged opportunity</small></div><span class="float-check">↗</span></div></div><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div>
      </section>
      <section class="trust-strip"><p>SAMPLE ACCOUNTS IN THE DEMO WORKSPACE</p><div class="trust-logos"><span><b>◈</b> northstar</span><span><b>✳</b> formwise</span><span><b>◉</b> brightpath</span><span><b>◌</b> vercelity</span><span><b>⌘</b> founder-led</span></div></section>
      <section class="landing-features" id="features"><div class="section-kicker"><i>✦</i> THE RELAY WORKSPACE</div><h2>Smarter CRM tools to<br>boost your sales<span class="orange">.</span></h2><p class="section-intro">Everything you need to manage customer context and move the next step forward.</p><div class="feature-grid"><article class="feature-card"><div class="feature-visual"><div class="feature-visual-title"><span>Lead management</span><span>↗</span></div><div class="lead-mini"><div><i class="lead-dot purple"></i><b>Maya Chen</b><span>Northstar Labs</span><em>Engaged</em></div><div><i class="lead-dot orange-dot"></i><b>Jordan Lee</b><span>Vercelity</span><em>New</em></div><div><i class="lead-dot green-dot"></i><b>Alex Morgan</b><span>Formwise</span><em>New</em></div></div></div><h3>Lead management</h3><p>Turn a lead list into connected account, contact, and deal records.</p></article><article class="feature-card"><div class="feature-visual"><div class="feature-visual-title"><span>Pipeline tracking</span><span>↗</span></div><div class="pipeline-mini"><div><small>OPEN PIPELINE</small><b>$124,500</b><span>Demo snapshot</span></div><div class="pipeline-line"><i></i><i></i><i></i><i></i></div><div class="pipeline-labels"><span>Prospecting</span><span>Qualified</span><span>Engaged</span><span>Won</span></div></div></div><h3>Pipeline tracking</h3><p>See the next step and deal context across every account.</p></article><article class="feature-card"><div class="feature-visual"><div class="feature-visual-title"><span>Customer context</span><span>↗</span></div><div class="insight-mini"><div class="insight-circle"><span>04</span><small>accounts</small></div><div><small>SAMPLE SIGNAL</small><b>“Let’s schedule a walkthrough.”</b><span>Reply added · demo</span></div></div></div><h3>Customer context</h3><p>Keep supplied facts and conversation history together.</p></article><article class="feature-card"><div class="feature-visual"><div class="feature-visual-title"><span>Approved workflows</span><span>↗</span></div><div class="automation-mini"><div class="auto-step"><i>01</i><span>Import lead list</span><b>✓</b></div><div class="auto-step"><i>02</i><span>Approve outreach plan</span><b>✓</b></div><div class="auto-step current"><i>03</i><span>Update CRM + hand off</span><b>↗</b></div></div></div><h3>Approved workflows</h3><p>Prepare outreach for review, then keep the CRM current as replies arrive.</p></article></div></section>
      <section class="landing-workflow" id="workflow"><div class="workflow-copy"><div class="section-kicker"><i>✦</i> ONE CONNECTED LOOP</div><h2>From first touch<br>to real momentum<span class="orange">.</span></h2><p>Customer details shouldn’t get lost between a spreadsheet, an inbox, and your CRM. Relay connects the work and keeps a clear record of every decision.</p><a href="/workspace" class="workflow-link">See Relay in action <span>↗</span></a><div class="workflow-steps-landing"><div><b>01</b><span>Import leads</span></div><i>→</i><div><b>02</b><span>Review &amp; approve</span></div><i>→</i><div><b>03</b><span>Learn &amp; hand off</span></div></div></div><div class="workflow-visual"><div class="workflow-glow"></div><div class="approval-card"><div class="approval-head"><span class="approval-icon">✳</span><div><small>OUTREACH PLAN · NORTHSTAR LABS</small><b>A thoughtful first conversation</b></div><span class="draft-tag">DRAFT</span></div><div class="approval-message"><small>TO MAYA CHEN · VP OF GROWTH</small><p>Hi Maya, I saw Northstar is building an AI operations platform for support teams…</p></div><div class="approval-actions"><span>✎ Edit draft</span><b>Approve plan <i>→</i></b></div></div><div class="reply-card"><span class="reply-avatar">MC</span><div><small>SIMULATED PROSPECT REPLY</small><b>“We’re interested. Can we see a walkthrough?”</b><span>CRM updated · handoff created</span></div><span class="reply-check">✓</span></div><div class="workflow-side-label">APPROVAL REQUIRED <i></i> RECORDS STAY AUDITABLE</div></div></section>
      <section class="landing-cta" id="about"><div class="cta-decoration">✳</div><div class="section-kicker"><i>✦</i> YOUR NEXT CUSTOMER, WITH CONTEXT</div><h2>Make every follow-up<br>feel like a fresh start.</h2><p>Bring your leads. Relay will keep the details and next steps connected.</p><a href="/workspace" class="hero-primary">Explore the demo workspace <span>↗</span></a><small>Demo mode · No external messages are sent</small></section>
      <footer class="landing-footer"><a href="/" class="landing-logo"><span>✳</span> relay<span class="orange">.</span></a><span>Account context in motion.</span><div><a href="#features">Features</a><a href="#workflow">Workflow</a><a href="/workspace">Open CRM</a></div><small>© 2026 Relay CRM · Demo workspace</small></footer>
    </main>`;
}

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

if (window.location.pathname === "/") renderLanding();
else render();
