import { importRows, loadData, resetData, saveData, type RelayData } from "./lib/crm-store";
import { parseCsv, sampleCsv, supportedCsvHeaders, type CsvPreview } from "./lib/csv-import";
import type { Account, GeneratedSequenceResult } from "./shared/contracts";
import { getCloudStatus, sendCloudMagicLink, signOutCloud, flushCloudSync, initializeCloudFromLocal, startCloudAgentRun, finishCloudAgentRun } from "./lib/supabase-sync";

let data: RelayData = loadData();
let preview: CsvPreview | null = null;
let sequence: { accountId: string; loading?: boolean; error?: string; result?: GeneratedSequenceResult } | undefined;
let proposal: { accountId: string; summary: string; nextStep: string } | undefined;
let inputError = "";
let importText = "";
let interactionSource = "Simulated prospect reply";
let actionStatus = "";
let actionBusy = false;
let settingsStatus = "";
let settingsStatusIsError = false;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]!));
const money = (v?: number) => v == null ? "—" : new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const stamp = () => new Date().toISOString();
export const getBasePath = () => location.pathname.startsWith("/Relay-CRM") ? "/Relay-CRM" : "";
export const toHref = (p: string) => `${getBasePath()}${p.startsWith("/") ? p : `/${p}`}`;
export const appPath = () => {
  const base = getBasePath();
  let p = location.pathname;
  if (base && p.startsWith(base)) {
    p = p.slice(base.length);
  }
  return p || "/";
};

let tourOpen = typeof window !== "undefined" && new URLSearchParams(location.search).get("tour") === "1";
let tourStep = 1;
let tourDockVisible = false;
let tourMinimized = false;
let tourCelebration = false;

function renderTourOverlay(): string {
  if (tourCelebration) {
    return `
      <div class="tour-modal-backdrop" id="tour-celebration-backdrop">
        <div class="tour-welcome-modal" style="text-align: center; max-width: 560px;">
          <div style="font-size: 42px; margin-bottom: 12px;">🏆</div>
          <span class="tour-badge" style="background: #ecfdf5; color: #059669;">ALL 4 WORKFLOWS VERIFIED</span>
          <h2>Outbound Loop Successfully Completed!</h2>
          <p class="tour-intro">You’ve experienced the end-to-end Relay CRM loop: Ingestion ➔ Grounded Account Brief ➔ Human Approval ➔ Inbound Intent Analysis ➔ Warm Handoff Queue.</p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 24px; display: grid; gap: 8px; font-size: 13px;">
            <div style="color: #059669; font-weight: 600;">✓ 01 · Lead Ingestion & Sourced Briefs Verified</div>
            <div style="color: #059669; font-weight: 600;">✓ 02 · Human-in-the-Loop Sequence Approval Verified</div>
            <div style="color: #059669; font-weight: 600;">✓ 03 · Inbound Signal Intent Detection Verified</div>
            <div style="color: #059669; font-weight: 600;">✓ 04 · Automated Warm Handoff & Audit Trail Verified</div>
          </div>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="tour-btn-primary" id="tour-celebration-close">Explore Full CRM Workspace ↗</button>
          </div>
        </div>
      </div>
    `;
  }

  if (tourOpen) {
    return `
      <div class="tour-modal-backdrop" id="tour-welcome-backdrop">
        <div class="tour-welcome-modal">
          <span class="tour-badge">✦ GUIDED DEMO TOUR · 2-MINUTE ONBOARDING</span>
          <h2>Welcome to the Relay CRM Demo</h2>
          <p class="tour-intro">Relay is an AI-native CRM for founder-led sales teams. Experience how the complete outbound loop functions without manual bookkeeping:</p>
          <div class="tour-steps-grid">
            <div class="tour-step-card">
              <div class="tour-step-top"><span class="tour-step-num">01 · INGEST LEADS</span><span class="tour-step-icon">📥</span></div>
              <b>Lead CSV Ingestion</b>
              <p>Upload raw lists to generate structured Account, Contact, and Deal records automatically.</p>
            </div>
            <div class="tour-step-card">
              <div class="tour-step-top"><span class="tour-step-num">02 · HUMAN IN THE LOOP</span><span class="tour-step-icon">✍️</span></div>
              <b>Review Outreach Sequences</b>
              <p>AI writes 3-touch emails tailored to pain points. You retain full approval before anything moves.</p>
            </div>
            <div class="tour-step-card">
              <div class="tour-step-top"><span class="tour-step-num">03 · SIGNAL DETECTION</span><span class="tour-step-icon">⚡</span></div>
              <b>Inbound Reply Analysis</b>
              <p>Prospect shows interest. AI extracts intent and proposes advancing deal stage to Demo Scheduled.</p>
            </div>
            <div class="tour-step-card">
              <div class="tour-step-top"><span class="tour-step-num">04 · WARM HANDOFF</span><span class="tour-step-icon">🤝</span></div>
              <b>Handoff Task Queue</b>
              <p>Auto-generates high-priority tasks with full buyer context and immutable audit trails.</p>
            </div>
          </div>
          <div class="tour-modal-actions">
            <span style="font-size: 12px; color: #6b7280;">Demo mode · Simulated actions safe to run</span>
            <div class="tour-modal-buttons">
              <button class="tour-btn-quiet" id="tour-welcome-skip">Skip & Explore</button>
              <button class="tour-btn-primary" id="tour-welcome-start">Start Guided Tour ➔</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (tourDockVisible) {
    if (tourMinimized) {
      return `
        <div class="tour-dock-minimized" id="tour-dock-unminimize" title="Click to expand tour guide">
          <i></i> <b>Tour: Step ${tourStep} of 4</b> <span>↗</span>
        </div>
      `;
    }

    const steps = [
      {
        num: 1,
        title: "Step 1: Accounts & Ingestion",
        desc: "Ingest CSV contacts and create linked Accounts, Contacts, and Opportunities with automatic fact labeling.",
        actionLabel: "Go to Accounts",
        actionPath: "/accounts"
      },
      {
        num: 2,
        title: "Step 2: Action Center & Approvals",
        desc: "Review batch outreach sequences before they are recorded. No unapproved external messages are sent.",
        actionLabel: "Go to Action Center",
        actionPath: "/action-center"
      },
      {
        num: 3,
        title: "Step 3: Outreach Sequences & AI Drafts",
        desc: "Personalized 3-step sequences with delay timing and grounded facts, verified by Gemini and Zod.",
        actionLabel: "Go to Automations",
        actionPath: "/automations"
      },
      {
        num: 4,
        title: "Step 4: Contextual Inbound & Warm Handoffs",
        desc: "Simulate prospect replies, capture buyer intent, update deal stages, and auto-assign follow-up tasks.",
        actionLabel: "Go to Tasks",
        actionPath: "/tasks"
      }
    ];
    const cur = steps[tourStep - 1]!;
    const pct = (tourStep / 4) * 100;

    return `
      <div class="tour-dock">
        <div class="tour-dock-bar">
          <div class="tour-dock-progress" style="width: ${pct}%"></div>
        </div>
        <div class="tour-dock-header">
          <span><i></i> STEP ${tourStep} OF 4</span>
          <div class="tour-dock-controls">
            <button class="tour-dock-btn" id="tour-dock-minimize" title="Minimize">−</button>
            <button class="tour-dock-btn" id="tour-dock-close" title="Close tour">×</button>
          </div>
        </div>
        <div class="tour-dock-body">
          <div class="tour-dock-title">${cur.title}</div>
          <div class="tour-dock-desc">${cur.desc}</div>
          <button class="tour-dock-action-btn" id="tour-dock-action" data-path="${cur.actionPath}">
            ${cur.actionLabel} ➔
          </button>
        </div>
        <div class="tour-dock-footer">
          <button class="tour-reset-btn" id="tour-dock-reset">↺ Reset</button>
          <div class="tour-dock-nav">
            <button class="tour-nav-btn" id="tour-dock-prev" ${tourStep === 1 ? "disabled" : ""}>←</button>
            <button class="tour-nav-btn tour-nav-next" id="tour-dock-next">
              ${tourStep === 4 ? "Finish Tour ✓" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

function attachTourListeners(app: HTMLDivElement): void {
  document.querySelectorAll<HTMLButtonElement>("#tour-topbar-pill-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      tourOpen = true;
      renderWorkspace(app);
    });
  });

  document.querySelector<HTMLButtonElement>("#tour-welcome-skip")?.addEventListener("click", () => {
    tourOpen = false;
    renderWorkspace(app);
  });

  document.querySelector<HTMLButtonElement>("#tour-welcome-start")?.addEventListener("click", () => {
    tourOpen = false;
    tourDockVisible = true;
    tourStep = 1;
    renderWorkspace(app);
  });

  document.querySelector<HTMLButtonElement>("#tour-dock-minimize")?.addEventListener("click", () => {
    tourMinimized = true;
    renderWorkspace(app);
  });

  document.querySelector<HTMLDivElement>("#tour-dock-unminimize")?.addEventListener("click", () => {
    tourMinimized = false;
    renderWorkspace(app);
  });

  document.querySelector<HTMLButtonElement>("#tour-dock-close")?.addEventListener("click", () => {
    tourDockVisible = false;
    renderWorkspace(app);
  });

  document.querySelector<HTMLButtonElement>("#tour-dock-action")?.addEventListener("click", (e) => {
    const targetPath = (e.currentTarget as HTMLButtonElement).dataset.path;
    if (targetPath) {
      history.pushState(null, "", toHref(targetPath));
      renderWorkspace(app);
    }
  });

  document.querySelector<HTMLButtonElement>("#tour-dock-prev")?.addEventListener("click", () => {
    if (tourStep > 1) {
      tourStep--;
      renderWorkspace(app);
    }
  });

  document.querySelector<HTMLButtonElement>("#tour-dock-next")?.addEventListener("click", () => {
    if (tourStep < 4) {
      tourStep++;
      renderWorkspace(app);
    } else {
      tourDockVisible = false;
      tourCelebration = true;
      renderWorkspace(app);
    }
  });

  document.querySelector<HTMLButtonElement>("#tour-celebration-close")?.addEventListener("click", () => {
    tourCelebration = false;
    renderWorkspace(app);
  });

  document.querySelector<HTMLButtonElement>("#tour-dock-reset")?.addEventListener("click", () => {
    data = resetData();
    renderWorkspace(app);
  });
}

export function renderWorkspace(app: HTMLDivElement): void {
  const path = appPath();
  if (path.startsWith("/accounts/")) return detail(app, decodeURIComponent(path.split("/")[2] ?? ""));
  if (path === "/accounts") return accounts(app);
  if (path === "/pipeline" || path === "/review") return pipeline(app);
  if (path === "/action-center" || path === "/handoffs") return dashboard(app, true);
  if (path === "/people") return people(app);
  if (path === "/tasks") return tasks(app);
  if (path === "/notes") return notes(app);
  if (path === "/reports") return reports(app);
  if (path === "/automations") return review(app);
  if (path === "/documentation") { location.href = toHref("/docs"); return; }
  if (path === "/settings") return settings(app);
  if (path === "/logout") return logout(app);
  dashboard(app);
}

/** Re-hydrate the module's view model after Supabase refreshes local storage. */
export function refreshWorkspaceFromStorage(app: HTMLDivElement): void {
  data = loadData();
  renderWorkspace(app);
}

function frame(app: HTMLDivElement, active: string, html: string): void {
  const brandLogo = `<a class="workspace-brand" href="/" title="Back to landing page"><span class="workspace-brand-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="21.5"></line><line x1="2.5" y1="12" x2="21.5" y2="12"></line><line x1="5.28" y1="5.28" x2="18.72" y2="18.72"></line><line x1="18.72" y1="5.28" x2="5.28" y2="18.72"></line></svg></span><span class="brand-text">relay<span class="orange">.</span></span></a>`;
  const nav = (key:string,label:string,icon:string,href:string,count=0) => `<a class="${active===key?"active":""}" href="${href}"><i>${icon}</i>${label}${count?`<span>${count}</span>`:""}</a>`;
  app.innerHTML = `<main class="workspace-shell"><aside class="workspace-sidebar">${brandLogo}<a class="quick-action" href="/action-center"><i>⌘</i> Action center <kbd>${data.accounts.filter(a=>!data.sequences.some(s=>s.accountId===a.id&&s.status==="approved")).length}</kbd></a><small class="workspace-label">WORKSPACE</small><nav class="app-nav">${nav("dashboard","Dashboard","⌂","/dashboard")}${nav("action-center","Action center","✦","/action-center",data.accounts.filter(a=>!data.sequences.some(s=>s.accountId===a.id&&s.status==="approved")).length)}${nav("accounts","Accounts","▤","/accounts")}${nav("pipeline","Pipeline","▥","/pipeline")}${nav("people","People","♙","/people")}${nav("tasks","Tasks","☑","/tasks",data.handoffs.filter(h=>h.status==="open").length)}${nav("notes","Notes","▧","/notes")}<span class="nav-section-label">INSIGHTS</span>${nav("reports","Reports","▥","/reports")}${nav("automations","Automations","▷","/automations")}${nav("docs","Documentation","▤","/docs")}</nav><div class="sidebar-bottom">${nav("settings","Settings","⚙","/settings")}${nav("logout","Log out","⇥","/logout")}<small>${getCloudStatus().connected ? "LIVE WORKSPACE · SUPABASE" : "DEMO WORKSPACE · DATA SAVED LOCALLY"}</small></div></aside><section class="workspace-main"><header class="workspace-mobile-head">${brandLogo}<select aria-label="Navigate" id="mobile-nav"><option value="/dashboard">Dashboard</option><option value="/action-center">Action center</option><option value="/accounts">Accounts</option><option value="/pipeline">Pipeline</option><option value="/people">People</option><option value="/tasks">Tasks</option><option value="/notes">Notes</option><option value="/reports">Reports</option><option value="/automations">Automations</option><option value="/docs">Documentation</option><option value="/settings">Settings</option><option value="/logout">Log out</option></select></header>${html}</section></main>${renderTourOverlay()}`;
  document.querySelector<HTMLSelectElement>("#mobile-nav")?.addEventListener("change",e=>{location.href=(e.target as HTMLSelectElement).value});
  for (const selector of ["#reset-data", "#reset-mobile"]) document.querySelector<HTMLButtonElement>(selector)?.addEventListener("click",()=>{data=resetData();preview=null;importText="";sequence=undefined;proposal=undefined;inputError="";renderWorkspace(app);});
  attachTourListeners(app);
}
function heading(kicker: string,title: string,desc: string, right=""): string {
  return `<header class="topbar"><div><p class="eyebrow">${kicker}</p><h1>${title}<span class="orange">.</span></h1><p class="subhead">${desc}</p></div><div style="display:flex;align-items:center;gap:10px;margin-left:auto;"><button id="tour-topbar-pill-btn" class="tour-topbar-pill"><i></i> Guided Demo Tour</button>${right}</div></header>`;
}

function pendingAccounts(): Account[] { return data.accounts.filter(a=>!data.sequences.some(s=>s.accountId===a.id&&s.status==="approved")); }
function dashboard(app: HTMLDivElement, focusActions=false): void {
 const pipelineValue=data.deals.reduce((sum,d)=>sum+(d.value??0),0), openTasks=data.handoffs.filter(h=>h.status==="open"), pending=pendingAccounts();
 frame(app,focusActions?"action-center":"dashboard",`${heading(focusActions?"WORKFLOW APPROVALS":"YOUR SALES WORKSPACE",focusActions?"Action center":"Dashboard","Keep the pipeline, people, and next steps moving from one place.",`<a href="/accounts" class="button primary">＋ Import leads</a>`)}<section class="stat-grid dashboard-stats"><article><small>OPEN PIPELINE</small><b>${money(pipelineValue)}</b><span>${data.deals.length} linked opportunities</span></article><article><small>ACCOUNTS</small><b>${String(data.accounts.length).padStart(2,"0")}</b><span>Persistent CRM records</span></article><article><small>AWAITING APPROVAL</small><b>${String(pending.length).padStart(2,"0")}</b><span>Human decision required</span></article><article class="stat-warm"><small>OPEN HANDOFFS</small><b>${String(openTasks.length).padStart(2,"0")}</b><span>Suggested human follow-ups</span></article></section><div class="dashboard-columns"><section class="panel action-center-panel" id="action-center"><div class="panel-head-row"><div><p class="eyebrow">ACTION CENTER</p><h2>Decisions waiting on you</h2><p class="muted">Approval records your choice for workflow tracking. No email is sent.</p></div>${pending.length?`<button id="approve-all" class="button primary" ${actionBusy?"disabled":""}>${actionBusy?"Approving…":`Approve all (${pending.length})`}</button>`:""}</div>${actionStatus?`<div class="alert ${actionStatus.startsWith("Could not")?"error":"success"}" role="status">${esc(actionStatus)}</div>`:""}${pending.length?`<div class="approval-list">${pending.map(a=>{const c=data.contacts.find(x=>x.accountId===a.id);return `<article class="approval-row"><span class="approval-avatar">${esc(a.companyName.split(/\s+/).map(x=>x[0]).slice(0,2).join(""))}</span><div><b>${esc(a.companyName)}</b><p>${esc(c?.name)} · plan can be generated and approved</p></div><a href="/automations?account=${encodeURIComponent(a.id)}">Review</a><button class="button mini-button" data-approve-account="${a.id}" ${actionBusy?"disabled":""}>${actionBusy?"Working…":"Approve plan"}</button></article>`}).join("")}</div>`:`<div class="empty-state compact-empty"><h3>All caught up</h3><p>There are no unapproved sequence plans. Import a lead to start another workflow.</p></div>`}</section><section class="panel handoff-preview"><div class="panel-head-row"><div><p class="eyebrow">HUMAN HANDOFFS</p><h2>Next steps for your team</h2><p class="muted">Created after a person confirms a CRM update.</p></div><a href="/tasks" class="text-link">View tasks ↗</a></div>${openTasks.length?openTasks.slice(0,4).map(h=>`<article class="handoff-row"><div><a href="/accounts/${encodeURIComponent(h.accountId)}"><b>${esc(data.accounts.find(a=>a.id===h.accountId)?.companyName??"Account")}</b></a><p>${esc(h.title)} · ${esc(h.reason)}</p></div><button class="button secondary" data-complete-task="${h.id}">Mark done</button></article>`).join(""):`<div class="empty-state compact-empty"><h3>No open handoffs</h3><p>Confirmed positive replies and call notes will appear here.</p><a href="/accounts" class="text-link">Open accounts ↗</a></div>`}</section></div><section class="panel dashboard-pipeline"><div class="panel-head-row"><div><p class="eyebrow">PIPELINE SNAPSHOT</p><h2>Recent opportunities</h2></div><a href="/pipeline" class="text-link">Open pipeline ↗</a></div><div class="table-wrap"><table><thead><tr><th>Account</th><th>Contact</th><th>Stage</th><th>Value</th><th>Next step</th></tr></thead><tbody>${data.accounts.slice(0,5).map(a=>{const d=data.deals.find(x=>x.accountId===a.id),c=data.contacts.find(x=>x.accountId===a.id);return `<tr><td><a class="account-link" href="/accounts/${encodeURIComponent(a.id)}"><b>${esc(a.companyName)}</b></a></td><td>${esc(c?.name)}</td><td><span class="stage ${d?.stage??""}">${esc(d?.stage)}</span></td><td>${money(d?.value)}</td><td>${esc(d?.nextStep??"—")}</td></tr>`}).join("")}</tbody></table></div></section>`);
 document.querySelector<HTMLButtonElement>("#approve-all")?.addEventListener("click",async()=>{actionBusy=true;actionStatus="Preparing approval…";dashboard(app,focusActions);for(const a of pendingAccounts()){try{await approveDemoSequence(a)}catch(error){actionStatus=`Could not approve ${a.companyName}: ${error instanceof Error?error.message:"sequence service unavailable"}`}}actionBusy=false;if(!actionStatus.startsWith("Could not"))actionStatus="All pending plans approved for workflow tracking. No messages were sent.";dashboard(app,focusActions)});
 document.querySelectorAll<HTMLButtonElement>("[data-approve-account]").forEach(b=>b.addEventListener("click",async()=>{const a=data.accounts.find(x=>x.id===b.dataset.approveAccount);if(!a)return;actionBusy=true;actionStatus=`Preparing ${a.companyName}…`;dashboard(app,focusActions);try{await approveDemoSequence(a);actionStatus=`${a.companyName} approved for workflow tracking. No message was sent.`}catch(error){actionStatus=`Could not approve ${a.companyName}: ${error instanceof Error?error.message:"sequence service unavailable"}`}actionBusy=false;dashboard(app,focusActions)}));
 document.querySelectorAll<HTMLButtonElement>("[data-complete-task]").forEach(b=>b.addEventListener("click",()=>{const task=data.handoffs.find(h=>h.id===b.dataset.completeTask);if(task){task.status="done";task.auditHistory.push({id:id("audit"),action:"updated",actor:"user",at:stamp(),summary:"Handoff marked done"});saveData(data);dashboard(app,focusActions)}}));
}

async function approveDemoSequence(account: Account): Promise<void> {
 const contact=data.contacts.find(c=>c.accountId===account.id);if(!contact)throw new Error("The linked contact record is missing.");
 const response=await fetch("/api/sequence",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({account,contact,notes:account.summary??""})});
 const payload=await response.json() as GeneratedSequenceResult|{error?:string};if(!response.ok||"error" in payload)throw new Error((payload as {error?:string}).error??"The sequence service returned an error.");
 const result=payload as GeneratedSequenceResult,at=stamp(),sequenceId=id("sequence"),audit={id:id("audit"),action:"approved" as const,actor:"user" as const,at,summary:"Approved in Action Center for workflow tracking; no message sent"};
 data.sequences=data.sequences.filter(s=>s.accountId!==account.id);data.sequences.push({id:sequenceId,accountId:account.id,status:"approved",rationale:result.brief,createdAt:at,approvedAt:at,auditHistory:[audit],steps:result.steps.map((s,i)=>({id:`${sequenceId}_${i}`,sequenceId,channel:"email",delayDays:s.delayDays,subject:s.subject,body:s.body,status:"approved",source:{type:result.mode==="gemini"?"ai":"user",label:result.mode==="gemini"?"Gemini generated · Zod validated":"Demo fixture · Zod validated"}}))});data.activities.push({id:id("activity"),accountId:account.id,type:"sequence_approval",summary:audit.summary,source:{type:"user",label:"Human approval in Action Center"},createdAt:at,auditHistory:[audit]});saveData(data);
}

function pipeline(app: HTMLDivElement): void {
 const contactNotes=data.activities.filter(a=>a.type==="interaction"&&a.source?.label?.toLowerCase().includes("call note"));
 const replies=data.activities.filter(a=>a.type==="interaction"&&a.source?.label?.toLowerCase().includes("reply"));
 const contactedIds=new Set(contactNotes.map(a=>a.accountId)),repliedIds=new Set(replies.map(a=>a.accountId));
 const columns=[{key:"contacted",title:"Contacted",desc:"Call notes logged",accounts:data.accounts.filter(a=>contactedIds.has(a.id))},{key:"replied",title:"Replied",desc:"Simulated prospect replies",accounts:data.accounts.filter(a=>repliedIds.has(a.id))},{key:"lost",title:"Leads lost",desc:"Deal marked lost",accounts:data.accounts.filter(a=>data.deals.some(d=>d.accountId===a.id&&d.stage==="lost"))}];
 frame(app,"pipeline",`${heading("RELATIONSHIP PIPELINE","Pipeline","Track contact, reply, and lost-deal signals from recorded CRM activity.",`<a href="/accounts" class="button primary">＋ Add leads</a>`)}<section class="pipeline-hero">${columns.map(c=>`<article class="pipeline-hero-card ${c.key}"><span>${c.title.toUpperCase()}</span><b>${String(c.accounts.length).padStart(2,"0")}</b><small>${c.desc}</small></article>`).join("")}</section><div class="pipeline-board">${columns.map(c=>`<section class="pipeline-column"><div class="pipeline-column-head"><div><h2>${c.title}</h2><small>${c.desc}</small></div><span>${c.accounts.length}</span></div>${c.accounts.length?c.accounts.map(a=>{const d=data.deals.find(x=>x.accountId===a.id),ct=data.contacts.find(x=>x.accountId===a.id),activity=data.activities.filter(x=>x.accountId===a.id&&x.type==="interaction").at(-1);return `<a class="pipeline-account-card" href="/accounts/${encodeURIComponent(a.id)}"><div><b>${esc(a.companyName)}</b><span>${esc(ct?.name)}</span></div><p>${esc(activity?.summary??d?.nextStep??"No recent activity")}</p><small>${d?money(d.value):"—"} · ${d?.stage??"No deal"}</small></a>`}).join(""):`<div class="board-empty">No records in this view yet.</div>`}</section>`).join("")}</div><p class="muted pipeline-disclaimer">Columns reflect recorded call notes, simulated reply entries, and deal stages. Sequence approval does not mean an email was sent.</p>`);
}

function people(app: HTMLDivElement): void {frame(app,"people",`${heading("RECORDS","People","Contacts connected to their account and current opportunity.",`<a href="/accounts" class="button primary">＋ Import contacts</a>`)}<section class="panel"><div class="section-heading"><div><h2>Contact directory</h2><p class="muted">${data.contacts.length} contacts from seeded records and CSV imports.</p></div></div>${data.contacts.length?`<div class="table-wrap"><table><thead><tr><th>Person</th><th>Company</th><th>Email</th><th>Title</th><th>Deal</th></tr></thead><tbody>${data.contacts.map(c=>{const a=data.accounts.find(x=>x.id===c.accountId),d=data.deals.find(x=>x.accountId===c.accountId);return `<tr><td><b>${esc(c.name)}</b></td><td><a class="account-link" href="/accounts/${encodeURIComponent(c.accountId)}">${esc(a?.companyName)}</a></td><td>${esc(c.email)}</td><td>${esc(c.title)}</td><td>${esc(d?.name)}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty-state">No contacts yet.</div>`}</section>`)}

function tasks(app: HTMLDivElement): void {frame(app,"tasks",`${heading("TEAM FOLLOW-UP","Tasks","Human handoffs created from confirmed account updates.",`<a href="/dashboard" class="button secondary">Back to dashboard</a>`)}<section class="panel"><div class="panel-head-row"><div><h2>Team task list</h2><p class="muted">Tasks are stored with the local CRM demo records.</p></div><span class="count">${data.handoffs.filter(h=>h.status==="open").length} open</span></div>${data.handoffs.length?data.handoffs.map(h=>`<article class="handoff-row"><div><a href="/accounts/${encodeURIComponent(h.accountId)}"><b>${esc(data.accounts.find(a=>a.id===h.accountId)?.companyName??"Account")}</b></a><p>${esc(h.title)} · ${esc(h.reason)}</p><small>${h.status==="open"?"Open":"Done"} · Human follow-up</small></div><button class="button secondary" data-task="${h.id}" ${h.status==="done"?"disabled":""}>${h.status==="done"?"Done ✓":"Mark done"}</button></article>`).join(""):`<div class="empty-state"><h3>No tasks yet</h3><p>Confirm a positive simulated interaction from an account to create a handoff task.</p><a href="/accounts" class="button primary">Open accounts</a></div>`}</section>`);document.querySelectorAll<HTMLButtonElement>("[data-task]").forEach(b=>b.addEventListener("click",()=>{const task=data.handoffs.find(h=>h.id===b.dataset.task);if(task){task.status="done";task.auditHistory.push({id:id("audit"),action:"updated",actor:"user",at:stamp(),summary:"Task marked done"});saveData(data);tasks(app)}}));}

function notes(app: HTMLDivElement): void {frame(app,"notes",`${heading("TEAM CONTEXT","Notes","Capture durable account context in the activity timeline.") }<section class="panel"><h2>Add an account note</h2><form id="note-form"><label for="note-account">Account</label><select id="note-account" required>${data.accounts.map(a=>`<option value="${a.id}">${esc(a.companyName)}</option>`).join("")}</select><label for="note-text">Note</label><textarea id="note-text" minlength="3" required placeholder="Add a useful account note…"></textarea><button class="button primary" type="submit">Save note</button></form></section><section class="panel"><h2>Recent notes</h2>${data.activities.filter(a=>a.type==="note").length?data.activities.filter(a=>a.type==="note").slice().reverse().map(a=>`<article class="timeline-entry"><b><a href="/accounts/${encodeURIComponent(a.accountId)}">${esc(data.accounts.find(x=>x.id===a.accountId)?.companyName??"Account")}</a></b><p>${esc(a.summary)}</p><small>${esc(a.source?.label??"User note")} · ${new Date(a.createdAt).toLocaleString()}</small></article>`).join(""):`<div class="empty-state">No notes yet. Save an account note to start the list.</div>`}</section>`);document.querySelector<HTMLFormElement>("#note-form")?.addEventListener("submit",e=>{e.preventDefault();const accountId=document.querySelector<HTMLSelectElement>("#note-account")?.value,text=document.querySelector<HTMLTextAreaElement>("#note-text")?.value.trim();if(!accountId||!text)return;const at=stamp(),entry={id:id("audit"),action:"created" as const,actor:"user" as const,at,summary:"Account note added"};data.activities.push({id:id("activity"),accountId,type:"note",summary:text,source:{type:"user",label:"User note"},createdAt:at,auditHistory:[entry]});saveData(data);notes(app)});}

function reports(app: HTMLDivElement): void {const deals=data.deals,stages=["prospecting","engaged","won","lost"].map(stage=>({stage,items:deals.filter(d=>d.stage===stage)})),max=Math.max(1,...stages.map(x=>x.items.reduce((n,d)=>n+(d.value??0),0)));frame(app,"reports",`${heading("INSIGHTS","Reports","A live summary of the records in this Relay workspace.") }<section class="stat-grid"><article><small>PIPELINE VALUE</small><b>${money(deals.reduce((n,d)=>n+(d.value??0),0))}</b><span>${deals.length} opportunities</span></article><article><small>WON VALUE</small><b>${money(deals.filter(d=>d.stage==="won").reduce((n,d)=>n+(d.value??0),0))}</b><span>Recorded as won</span></article><article><small>WIN RATE</small><b>${deals.filter(d=>["won","lost"].includes(d.stage)).length?Math.round(deals.filter(d=>d.stage==="won").length/deals.filter(d=>["won","lost"].includes(d.stage)).length*100):0}%</b><span>Won ÷ closed deals</span></article><article><small>ACTIVITY</small><b>${data.activities.length}</b><span>Recorded timeline events</span></article></section><section class="panel report-panel"><h2>Deal value by stage</h2><p class="muted">Computed from local CRM records.</p><div class="report-bars">${stages.map(x=>`<div class="report-bar-row"><span>${x.stage}</span><div><i style="width:${Math.round(x.items.reduce((n,d)=>n+(d.value??0),0)/max*100)}%"></i></div><b>${money(x.items.reduce((n,d)=>n+(d.value??0),0))}</b></div>`).join("")}</div></section>`)}

function documentation(app: HTMLDivElement): void { location.href = "/docs"; }

function settings(app: HTMLDivElement): void {
  const cloud = getCloudStatus();
  const connectionPanel = cloud.connected
    ? `<p class="muted">Signed in as <b>${esc(cloud.email)}</b><br>Workspace <code>${esc(cloud.workspaceId)}</code><br>${esc(cloud.message)}</p>${cloud.hasData?"":`<button class="button primary" id="cloud-initialize">Sync local CRM records to Supabase</button>`}<button class="button secondary" id="cloud-signout">Sign out of Supabase</button>`
    : cloud.configured
      ? `<p class="muted">${esc(cloud.message ?? "Sign in to connect your workspace.")}</p><form id="cloud-login-form"><label for="cloud-email">Work email</label><input id="cloud-email" type="email" required autocomplete="email" placeholder="you@company.com"><button class="button primary" type="submit">Email me a sign-in link</button></form>`
      : `<p class="muted">${esc(cloud.message ?? "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the repo-root .env.local to enable cloud mode.")}</p>`;
  frame(app,"settings",`${heading("PREFERENCES","Settings","Workspace, live connection, and demo-data controls.")}${settingsStatus?`<div class="alert ${settingsStatusIsError?"error":"success"}" role="${settingsStatusIsError?"alert":"status"}">${esc(settingsStatus)}</div>`:""}<section class="panel settings-row"><div><h2>CRM workspace</h2>${connectionPanel}</div><span class="source-chip">${cloud.connected?(cloud.hasData?"LIVE · SUPABASE":"CONNECTED · EMPTY"):cloud.configured?"SIGN IN REQUIRED":"LOCAL DEMO"}</span></section><section class="panel settings-row"><div><h2>Realtime updates</h2><p class="muted">${cloud.connected&&cloud.hasData?"Accounts, deals, activities, handoffs, and agent runs refresh from the authorized workspace channel.":cloud.connected?"Initialize the cloud workspace once; then Relay will sync changes and listen for Realtime updates.":"Sign in to enable workspace-scoped Supabase Realtime. Local demo data continues to work without a session."}</p></div><span class="source-chip">${cloud.connected&&cloud.hasData?"REALTIME ON":cloud.connected?"READY TO SYNC":"AUTH REQUIRED"}</span></section><section class="panel settings-row"><div><h2>AI sequence drafts</h2><p class="muted">Gemini runs through the server route. Without GEMINI_API_KEY, Relay uses a labeled deterministic fixture.</p></div><span class="source-chip">SERVER ONLY</span></section><section class="panel danger-zone"><div><h2>Reset demo data</h2><p class="muted">Restore the four synthetic seeded accounts. When connected, this also replaces the current Supabase workspace records.</p></div><button class="button secondary" id="settings-reset">Reset demo data</button></section>`);
  document.querySelector<HTMLFormElement>("#cloud-login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector<HTMLButtonElement>("#cloud-login-form button[type=submit]");
    const email = document.querySelector<HTMLInputElement>("#cloud-email")?.value.trim();
    if (!email || !button) return;
    button.disabled = true; button.textContent = "Sending link…";
    try { await sendCloudMagicLink(email); settingsStatusIsError=false; settingsStatus = `Sign-in link sent to ${email}. Open it in this browser to connect Relay.`; }
    catch (error) {
      settingsStatusIsError=true;
      const message=error instanceof Error?error.message:"Could not send the sign-in link.";
      settingsStatus=/invalid api key/i.test(message)
        ? "Supabase rejected this API key. In your Supabase project, copy the Project URL and Publishable key from Settings → API Keys into the repo-root .env.local, then restart the dev server. Make sure both values are from the same project."
        : message;
    }
    settings(app);
  });
  document.querySelector<HTMLButtonElement>("#cloud-initialize")?.addEventListener("click", async () => {
    const button=document.querySelector<HTMLButtonElement>("#cloud-initialize"); if(button){button.disabled=true;button.textContent="Syncing records…";}
    try { await initializeCloudFromLocal(); settingsStatusIsError=false; settingsStatus="Local CRM records copied to your Supabase workspace."; }
    catch (error) { settingsStatusIsError=true; settingsStatus=error instanceof Error?error.message:"Could not sync local records."; }
    settings(app);
  });
  document.querySelector<HTMLButtonElement>("#cloud-signout")?.addEventListener("click", async () => {
    try { await signOutCloud(); settingsStatusIsError=false; settingsStatus = "Signed out. This browser is back in local demo mode."; }
    catch (error) { settingsStatusIsError=true; settingsStatus = error instanceof Error ? error.message : "Could not sign out."; }
    settings(app);
  });
  document.querySelector<HTMLButtonElement>("#settings-reset")?.addEventListener("click", async () => {
    data=resetData(); preview=null; sequence=undefined; proposal=undefined;
    if (cloud.connected) { if(cloud.hasData) await flushCloudSync(); else await initializeCloudFromLocal(); settingsStatus="Synthetic demo records restored in this browser and Supabase workspace."; }
    else settingsStatus="Demo data restored to the seeded workspace.";
    settings(app);
  });
}

function logout(app: HTMLDivElement): void {
  const cloud = getCloudStatus();
  frame(app,"logout",`${heading("WORKSPACE SESSION","Log out","End the current Supabase Auth session.") }<section class="panel empty-state"><h2>${cloud.connected?"Signed in":"No account session"}</h2><p>${cloud.connected?`Relay is connected as ${esc(cloud.email)}.`:"This browser is using local demo records."}</p>${cloud.connected?`<button class="button primary" id="logout-now">Sign out</button>`:`<a href="/settings" class="button primary">Connect a workspace</a>`}<a href="/dashboard" class="text-link">Return to dashboard</a></section>`);
  document.querySelector<HTMLButtonElement>("#logout-now")?.addEventListener("click",async()=>{await signOutCloud();location.href="/dashboard"});
}
function accounts(app: HTMLDivElement): void {
 const contact=new Map(data.contacts.map(c=>[c.accountId,c])), deal=new Map(data.deals.map(d=>[d.accountId,d]));
 const pipeline=data.deals.reduce((sum,d)=>sum+(d.value??0),0);
 frame(app,"accounts",`${heading("CRM RECORDS","Accounts &amp; imports","Import leads and browse linked account, contact, and deal records.",`<button class="button secondary" id="reset-top">Reset demo data</button>`)}<section class="stat-grid"><article><small>OPEN PIPELINE</small><b>${money(pipeline)}</b><span>Across ${data.deals.length} opportunities</span></article><article><small>ACTIVE ACCOUNTS</small><b>${String(data.accounts.length).padStart(2,"0")}</b><span>Seeded + imported records</span></article><article><small>NEEDS REVIEW</small><b>${String(data.sequences.filter(s=>s.status==="pending").length).padStart(2,"0")}</b><span>Approval stays with you</span></article><article class="stat-warm"><small>OPEN HANDOFFS</small><b>${String(data.handoffs.filter(h=>h.status==="open").length).padStart(2,"0")}</b><span>Ready for a human</span></article></section><section class="import-card"><div class="section-heading"><div><p class="eyebrow">CSV IMPORT</p><h2>Bring in your lead list</h2><p class="muted">Required columns: ${supportedCsvHeaders.slice(0,3).map(h=>`<code>${h}</code>`).join(", ")}</p></div><div class="actions"><button class="button secondary" id="download-sample">Download sample CSV</button><button class="button secondary" id="load-sample">Load sample</button><label class="button primary file-button">Choose CSV<input id="csv-file" type="file" accept=".csv,text/csv"></label></div></div><div class="dropzone"><textarea id="csv-text" placeholder="Paste CSV here or load the sample…" aria-label="CSV input">${esc(importText)}</textarea><div class="dropzone-copy"><span class="upload-icon">↥</span><strong>Paste CSV or choose a file</strong><span class="muted">Review valid rows before saving CRM records.</span></div></div><div id="import-feedback"></div></section><section class="pipeline"><div class="section-heading"><div><p class="eyebrow">PIPELINE</p><h2>Accounts</h2><p class="muted">Open any account record to see context and activity.</p></div><span class="count">${data.accounts.length} accounts</span></div>${data.accounts.length?`<div class="table-wrap"><table><thead><tr><th>Account</th><th>Contact</th><th>Deal</th><th>Stage</th><th>Value</th><th>Next step</th><th></th></tr></thead><tbody>${data.accounts.map(a=>{const c=contact.get(a.id),d=deal.get(a.id);return `<tr><td><a class="account-link" href="/accounts/${encodeURIComponent(a.id)}"><strong>${esc(a.companyName)}</strong></a><span class="cell-sub">${esc(a.domain)}</span></td><td>${esc(c?.name)}<span class="cell-sub">${esc(c?.title)}</span></td><td>${esc(d?.name)}</td><td><span class="stage ${d?.stage??""}">${esc(d?.stage)}</span></td><td>${money(d?.value)}</td><td>${esc(d?.nextStep)||"—"}</td><td><a class="button mini-button" href="/automations?account=${encodeURIComponent(a.id)}">Review plan</a></td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty-state"><h3>No accounts yet</h3><p>Load sample leads or import a CSV to create linked records.</p></div>`}</section>`);
 document.querySelector<HTMLButtonElement>("#reset-top")?.addEventListener("click",()=>{data=resetData();preview=null;importText="";sequence=undefined;proposal=undefined;renderWorkspace(app)});
 document.querySelector<HTMLButtonElement>("#download-sample")?.addEventListener("click",()=>{const u=URL.createObjectURL(new Blob([sampleCsv],{type:"text/csv"}));const a=document.createElement("a");a.href=u;a.download="relay-sample-leads.csv";a.click();URL.revokeObjectURL(u)});
 document.querySelector<HTMLButtonElement>("#load-sample")?.addEventListener("click",()=>{importText=sampleCsv;preview=parseCsv(sampleCsv);document.querySelector<HTMLTextAreaElement>("#csv-text")!.value=sampleCsv;showPreview()});
 document.querySelector<HTMLTextAreaElement>("#csv-text")?.addEventListener("input",e=>{importText=(e.target as HTMLTextAreaElement).value;preview=parseCsv(importText);showPreview()});
 document.querySelector<HTMLInputElement>("#csv-file")?.addEventListener("change",e=>{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{importText=String(r.result??"");preview=parseCsv(importText);document.querySelector<HTMLTextAreaElement>("#csv-text")!.value=importText;showPreview()};r.onerror=()=>{const box=document.querySelector("#import-feedback");if(box)box.innerHTML=`<div class="alert error" role="alert">Could not read this file. Choose a readable CSV.</div>`};r.readAsText(f)});
 function showPreview(){const target=document.querySelector<HTMLDivElement>("#import-feedback");if(!target||!preview)return;target.innerHTML=preview.errors.length?`<div class="alert error" role="alert">${preview.errors.map(e=>`Row ${e.row}: ${esc(e.message)}`).join(" · ")}</div>`:`<div class="alert success">${preview.rows.length} valid leads ready. Nothing is saved until you confirm.</div><div class="preview-heading"><h3>Import preview</h3><button id="confirm-import" class="button primary">Import ${preview.rows.length} leads</button></div><div class="preview-table"><table><thead><tr><th>Company</th><th>Contact</th><th>Deal</th><th>Value</th></tr></thead><tbody>${preview.rows.map(r=>`<tr><td>${esc(r.company_name)}</td><td>${esc(r.contact_name)}</td><td>${esc(r.deal_name)}</td><td>${money(r.deal_value)}</td></tr>`).join("")}</tbody></table></div>`;document.querySelector<HTMLButtonElement>("#confirm-import")?.addEventListener("click",()=>{if(!preview||preview.errors.length)return;data=importRows(data,preview.rows);preview=null;importText="";renderWorkspace(app)});}
 if(preview)showPreview();
}

function detail(app: HTMLDivElement, accountId: string): void {
 const a=data.accounts.find(x=>x.id===accountId),c=data.contacts.find(x=>x.accountId===accountId),d=data.deals.find(x=>x.accountId===accountId);
 if(!a||!c||!d){frame(app,"accounts",`<section class="panel"><h1>Account not found</h1><p>This record may have been removed by a demo reset.</p><a href="/workspace" class="button primary">Back to accounts</a></section>`);return;}
 const items=data.activities.filter(x=>x.accountId===a.id).slice().reverse();
 frame(app,"accounts",`<p class="back-line"><a href="/dashboard">← Dashboard</a> / ${esc(a.companyName)}</p>${heading("ACCOUNT RECORD · SOURCES LABELED",esc(a.companyName),esc(a.summary),`<a class="button primary" href="/automations?account=${encodeURIComponent(a.id)}">✦ Review sequence</a>`)}<div class="detail-grid"><div><section class="panel"><div class="section-heading"><div><h2>Key contact</h2><p class="muted">${esc(c.title)}</p></div><span class="source-chip">${esc(c.source?.label??"User supplied")}</span></div><b>${esc(c.name)}</b><p>${esc(c.email)}</p></section><section class="panel"><div class="section-heading"><div><h2>Log a conversation</h2><p class="muted">Simulate an inbound reply or add a call note. Nothing is sent.</p></div><span class="source-chip">SIMULATED INPUT</span></div><form id="interaction-form"><label for="interaction-kind">Interaction type</label><select id="interaction-kind"><option value="Simulated prospect reply">Prospect reply</option><option value="Simulated call note">Call note</option></select><label for="reply-text">Reply or call note</label><textarea id="reply-text" minlength="3" required placeholder="Example: Interested in a walkthrough next week; asked about onboarding."></textarea>${inputError?`<p role="alert" class="inline-error">${esc(inputError)}</p>`:""}<button class="button primary" type="submit">${proposal?.accountId===a.id?"Update proposal":"Prepare CRM update"}</button></form>${proposal?.accountId===a.id?`<div class="proposal"><span class="source-chip">DEMO SUGGESTION · REVIEW REQUIRED</span><h3>Proposed CRM update</h3><p>${esc(proposal.summary)}</p><p>Deal stage <b>Engaged</b> · Next step <b>${esc(proposal.nextStep)}</b></p><p class="muted">This simulated interaction suggests a next step; inspect and confirm to save.</p><button class="button primary" id="confirm-update">Confirm and update CRM</button></div>`:""}</section></div><aside><section class="panel"><p class="eyebrow">OPPORTUNITY</p><h2>${esc(d.name)}</h2><div class="deal-value">${money(d.value)}</div><p><span class="stage ${d.stage}">${esc(d.stage)}</span></p><p>Next step<br><b>${esc(d.nextStep)}</b></p></section><section class="panel"><h2>Activity timeline</h2><p class="muted">${items.length} recorded items</p>${items.length?items.map(i=>`<article class="timeline-entry"><b>${esc(i.type.replaceAll("_"," "))}</b><p>${esc(i.summary)}</p><small>${esc(i.source?.label??"CRM")} · ${new Date(i.createdAt).toLocaleString()}</small></article>`).join(""):`<div class="empty-state">No activity yet. Confirm an approval or add a conversation.</div>`}</section></aside></div>`);
 document.querySelector<HTMLFormElement>("#interaction-form")?.addEventListener("submit",e=>{e.preventDefault();const text=document.querySelector<HTMLTextAreaElement>("#reply-text")?.value.trim()??"";interactionSource=document.querySelector<HTMLSelectElement>("#interaction-kind")?.value??"Simulated prospect reply";if(text.length<3){inputError="Add a reply or call note to continue.";return detail(app,a.id)}proposal={accountId:a.id,summary:text,nextStep:"Schedule a product walkthrough"};inputError="";detail(app,a.id)});
 document.querySelector<HTMLButtonElement>("#confirm-update")?.addEventListener("click",()=>{if(!proposal)return;const at=stamp(),entry={id:id("audit"),action:"updated" as const,actor:"user" as const,at,summary:"Confirmed CRM update from simulated interaction"};d.stage="engaged";d.nextStep=proposal.nextStep;d.auditHistory.push(entry);a.updatedAt=at;a.auditHistory.push(entry);data.activities.push({id:id("activity"),accountId:a.id,contactId:c.id,type:"interaction",summary:proposal.summary,source:{type:"user",label:interactionSource},createdAt:at,auditHistory:[entry]});data.handoffs.unshift({id:id("handoff"),accountId:a.id,title:"Schedule product walkthrough",reason:"Prospect expressed interest in a walkthrough.",status:"open",auditHistory:[{...entry,summary:"Created after human confirmation"}]});saveData(data);proposal=undefined;detail(app,a.id)});
}

function review(app: HTMLDivElement): void {
 const accountId=new URLSearchParams(location.search).get("account")??data.accounts[0]?.id;
 const a=data.accounts.find(x=>x.id===accountId);
 if(!a){frame(app,"automations",`<div class="empty-state"><h2>No accounts to review</h2><p>Import a lead list first.</p><a href="/workspace" class="button primary">Open accounts</a></div>`);return;}
 const c=data.contacts.find(x=>x.accountId===a.id)!;let saved=data.sequences.find(x=>x.accountId===a.id);let activeRunId:string|undefined;const result=sequence?.accountId===a.id?sequence.result:undefined;
 frame(app,"automations",`${heading("AUTOMATIONS","Outreach sequences","Inspect account-specific plans and approve them for workflow tracking. Nothing is sent.",`<a class="button secondary" href="/accounts/${encodeURIComponent(a.id)}">Account detail ↗</a>`)}<div class="review-layout"><aside class="panel review-list"><h2>Accounts</h2>${data.accounts.map(x=>`<a class="review-account ${x.id===a.id?"selected":""}" href="/automations?account=${encodeURIComponent(x.id)}"><b>${esc(x.companyName)}</b><small>${esc(data.contacts.find(c=>c.accountId===x.id)?.name)}</small></a>`).join("")}</aside><section class="panel"><p class="eyebrow">PERSONALIZED OUTREACH PLAN</p><h2>${esc(a.companyName)}</h2><p class="muted">To ${esc(c.name)} · ${esc(c.title)}</p>${sequence?.loading&&sequence.accountId===a.id?`<div class="loading-state"><span class="spinner"></span>Preparing and validating draft…</div>`:""}${sequence?.error&&sequence.accountId===a.id?`<div class="alert error" role="alert">${esc(sequence.error)}<button class="button secondary" id="retry-sequence">Retry</button></div>`:""}${result?`<div class="source-chip">${result.mode==="demo_fixture"?"DEMO FIXTURE":"GEMINI OUTPUT"} · ZOD VALIDATED</div>${result.fallbackReason?`<div class="alert error"><b>Provider fallback</b><span>${esc(result.fallbackReason)}</span></div>`:""}<p>${esc(result.brief)}</p><div class="fact-list"><b>Facts used</b>${result.facts.map(f=>`<span>${esc(f.key)}: ${esc(f.value)} <em>${esc(f.source.label??f.source.type)}</em></span>`).join("")}</div>${result.steps.map((s,i)=>`<article class="step"><span class="step-number">${i+1}</span><div><small>DAY ${s.delayDays}</small><h3>${esc(s.subject)}</h3><p>${esc(s.body)}</p><small>${esc(s.rationale)}</small></div></article>`).join("")}`:saved?`<div class="source-chip">${esc(saved.steps[0]?.source?.label??"Saved demo proposal")}</div>${saved.steps.map((s,i)=>`<article class="step"><span class="step-number">${i+1}</span><div><small>DAY ${s.delayDays}</small><h3>${esc(s.subject)}</h3><p>${esc(s.body)}</p></div></article>`).join("")}`:`<div class="empty-state"><h3>No proposal yet</h3><p>Generate a server-side draft, or use the deterministic fixture when credentials are absent.</p></div>`}<div class="actions"><button class="button secondary" id="generate-review" ${sequence?.loading?"disabled":""}>${sequence?.loading?"Generating…":"Generate draft"}</button>${(result||saved)?`<button class="button primary" id="approve-sequence" ${saved?.status==="approved"?"disabled":""}>${saved?.status==="approved"?"Approved ✓":"Approve plan"}</button>`:""}</div><p class="muted note">Approval records your decision. No email or external action is triggered.</p></section></div>`);
 const generate=async()=>{sequence={accountId:a.id,loading:true};review(app);activeRunId=await startCloudAgentRun("outreach_planner",a.id,{account:a,contact:c,notes:a.summary??""});try{const response=await fetch("/api/sequence",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({account:a,contact:c,notes:a.summary??""})});const body=await response.json();if(!response.ok||body.error)throw new Error(body.error??"Sequence service failed.");await finishCloudAgentRun(activeRunId,{status:"awaiting_approval",provider:body.mode,output:body as Record<string,unknown>});sequence={accountId:a.id,result:body as GeneratedSequenceResult}}catch(error){await finishCloudAgentRun(activeRunId,{status:"failed",error:"Sequence preparation failed; no CRM changes were applied."});sequence={accountId:a.id,error:error instanceof Error?`${error.message} Is the Relay API running?`:"Could not prepare the draft."}}review(app)};
 document.querySelector<HTMLButtonElement>("#generate-review")?.addEventListener("click",generate);document.querySelector<HTMLButtonElement>("#retry-sequence")?.addEventListener("click",generate);
 document.querySelector<HTMLButtonElement>("#approve-sequence")?.addEventListener("click",()=>{const r=sequence?.accountId===a.id?sequence.result:undefined;if(!r)return;const at=stamp(),sid=id("sequence");data.sequences=data.sequences.filter(x=>x.accountId!==a.id);saved={id:sid,accountId:a.id,status:"approved",rationale:r.brief,createdAt:at,approvedAt:at,auditHistory:[{id:id("audit"),action:"approved",actor:"user",at,summary:"Approved for workflow tracking; no message sent"}],steps:r.steps.map((s,i)=>({id:`${sid}_${i}`,sequenceId:sid,channel:"email",delayDays:s.delayDays,subject:s.subject,body:s.body,status:"approved",source:{type:r.mode==="gemini"?"ai":"user",label:r.mode==="gemini"?"Gemini generated · Zod validated":"Demo fixture · Zod validated"}}))};data.sequences.push(saved);data.activities.push({id:id("activity"),accountId:a.id,type:"sequence_approval",summary:"Outreach plan approved for workflow tracking. No message was sent.",source:{type:"user",label:"Human approval"},createdAt:at,auditHistory:[]});saveData(data);void finishCloudAgentRun(activeRunId,{status:"completed",provider:r.mode,output:{approved:true,sequenceId:sid}});review(app)});
}
