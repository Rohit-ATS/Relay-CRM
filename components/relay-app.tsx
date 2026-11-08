"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createDemoSequence, demoAccounts, demoHandoffs, demoSequences } from "@/lib/demo-data";
import { loadWorkspace } from "@/lib/backend";
import type { Account, Handoff, Sequence } from "@/lib/types";
import "../next-ui/app/tour.css";

type Screen = "accounts" | "detail" | "review" | "handoffs";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const SAMPLE_CSV_CONTENT = `company,name,email,title,domain,industry,deal_value,source_notes
Northstar Labs,Maya Chen,maya@northstarlabs.com,VP Growth,northstarlabs.com,AI Operations,48000,Series A inbound
FinScale AI,Sarah Chen,sarah@finscale.ai,VP Engineering,finscale.ai,Fintech Infrastructure,65000,Scaling outbound
CloudOps Pro,Marcus Vance,marcus@cloudopspro.io,Head of DevOps,cloudopspro.io,Cloud Observability,32000,Evaluates Relay`;

export default function RelayApp({ screen, accountId = "northstar" }: { screen: Screen; accountId?: string }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>(demoAccounts);
  const [handoffs, setHandoffs] = useState<Handoff[]>(demoHandoffs);
  const [sequences, setSequences] = useState<Record<string, Sequence>>(demoSequences);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [interaction, setInteraction] = useState("");
  const [proposal, setProposal] = useState<any>(null);
  const [fileRows, setFileRows] = useState<any[]>([]);
  const [fileText, setFileText] = useState("");
  const [preview, setPreview] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(accountId);

  // Guided Demo Tour States (BigTech Onboarding)
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(1);
  const [tourDockVisible, setTourDockVisible] = useState(false);
  const [tourMinimized, setTourMinimized] = useState(false);
  const [tourCelebration, setTourCelebration] = useState(false);

  useEffect(() => {
    let active = true;
    loadWorkspace()
      .then(({ accounts: remoteAccounts, handoffs: remoteHandoffs }) => {
        if (!active) return;
        setAccounts(remoteAccounts);
        setHandoffs(remoteHandoffs);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setNotice("Backend unavailable · showing demo fixture data");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Check Tour URL Params & LocalStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const isTourParam = params.get("tour") === "1" || params.get("demo") === "1";
      const seen = localStorage.getItem("relay_demo_tour_seen");
      const savedStep = parseInt(localStorage.getItem("relay_demo_tour_step") || "1", 10);
      const savedActive = localStorage.getItem("relay_demo_tour_active") === "true";

      if (isTourParam || (!seen && screen === "accounts")) {
        setTourOpen(true);
        setTourStep(1);
        setTourDockVisible(true);
      } else if (savedActive) {
        setTourStep(savedStep || 1);
        setTourDockVisible(true);
      }
    }
  }, [screen]);

  const account = accounts.find((a) => a.id === (screen === "review" ? selectedAccountId : accountId)) || accounts[0];
  const filtered = useMemo(
    () =>
      accounts.filter((a) =>
        `${a.company} ${a.contact.name} ${a.industry}`.toLowerCase().includes(query.toLowerCase())
      ),
    [accounts, query]
  );
  const sequence = sequences[account?.id] || createDemoSequence(account);
  const setSequence = (s: Sequence) => setSequences((prev) => ({ ...prev, [s.accountId]: s }));

  async function makeSequence() {
    setBusy(true);
    try {
      const r = await fetch("/api/sequence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          contactId: account.contact.id,
          account: {
            company: account.company,
            industry: account.industry,
            summary: account.summary,
            sourceNotes: account.sourceNotes,
            contact: account.contact,
            deal: account.deal,
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || "Sequence request failed");
      if (j.sequence) setSequence(j.sequence);
      setNotice(j.label || "Sequence draft ready");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not load the sequence draft.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!sequence.id) {
      setNotice("Generate the draft before approving it.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/sequence/${sequence.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: "Approved in Relay workspace" }),
      });
      if (!r.ok) throw new Error("Could not approve the sequence in the CRM.");
      setSequence({ ...sequence, status: "approved" });
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, sequenceStatus: "Approved · scheduled" } : a))
      );
      setNotice("Plan approved · no message sent");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not approve the sequence.");
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    setBusy(true);
    setProposal(null);
    try {
      const r = await fetch("/api/interactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: account.id, text: interaction }),
      });
      const j = await r.json();
      setProposal(j.proposal);
      if (j.error) setNotice(j.error);
    } catch {
      setNotice("Could not prepare an update.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptProposal() {
    if (!proposal) return;
    setBusy(true);
    try {
      const r = await fetch("/api/interactions/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          contactId: account.contact.id,
          text: interaction,
          dealStage: proposal.dealStage,
          nextTask: proposal.nextTask,
          reason: proposal.reason,
        }),
      });
      if (!r.ok) throw new Error("Could not confirm the CRM update.");
      const remote = await loadWorkspace();
      setAccounts(remote.accounts);
      setHandoffs(remote.handoffs);
      setNotice("CRM updated · activity logged");
      setProposal(null);
      setInteraction("");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not confirm the CRM update.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const r = await fetch("/api/reset", { method: "POST" });
      if (!r.ok) throw new Error("Could not reset the backend demo data.");
      const remote = await loadWorkspace();
      setAccounts(remote.accounts);
      setHandoffs(remote.handoffs);
      setSequences(demoSequences);
      setNotice("Demo workspace reset");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not reset demo workspace.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadSample() {
    const r = await fetch("/api/import/sample");
    if (!r.ok) {
      setNotice("Could not download the sample CSV.");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([await r.text()], { type: "text/csv" }));
    a.download = "relay-sample-leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function parseFile(f: File) {
    const text = await f.text();
    setFileText(text);
    setBusy(true);
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv_text: text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || "Import preview failed");
      setFileRows(j.rows || []);
      setPreview(true);
      setNotice(j.errors?.length ? `${j.errors.length} row(s) need attention` : "Import preview ready");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not preview the CSV");
    } finally {
      setBusy(false);
    }
  }

  async function previewSampleCsvDirectly() {
    setFileText(SAMPLE_CSV_CONTENT);
    setFileRows([
      { company: "Northstar Labs", name: "Maya Chen", email: "maya@northstarlabs.com" },
      { company: "FinScale AI", name: "Sarah Chen", email: "sarah@finscale.ai" },
      { company: "CloudOps Pro", name: "Marcus Vance", email: "marcus@cloudopspro.io" },
    ]);
    setPreview(true);
    setNotice("Sample leads loaded for preview");
  }

  async function commitImport() {
    setBusy(true);
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commit: true, csv_text: fileText }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail?.message || j.error || "Import failed");
      const remote = await loadWorkspace();
      setAccounts(remote.accounts);
      setHandoffs(remote.handoffs);
      setPreview(false);
      setFileRows([]);
      setFileText("");
      setNotice(`${j.imported_accounts || 0} account(s) imported`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not import the leads");
    } finally {
      setBusy(false);
    }
  }

  // Tour Controller Handlers
  const startTourFromWelcome = () => {
    localStorage.setItem("relay_demo_tour_seen", "true");
    localStorage.setItem("relay_demo_tour_active", "true");
    localStorage.setItem("relay_demo_tour_step", "1");
    setTourOpen(false);
    setTourDockVisible(true);
    setTourStep(1);
    if (screen !== "accounts") router.push("/workspace");
  };

  const closeTourWelcome = () => {
    localStorage.setItem("relay_demo_tour_seen", "true");
    setTourOpen(false);
  };

  const goToTourStep = (step: number) => {
    setTourStep(step);
    localStorage.setItem("relay_demo_tour_step", String(step));
    if (step === 1 && screen !== "accounts") router.push("/workspace");
    if (step === 2 && screen !== "review") router.push("/review");
    if (step === 3 && screen !== "detail") router.push(`/accounts/${accounts[0]?.id || "northstar"}`);
    if (step === 4 && screen !== "handoffs") router.push("/handoffs");
  };

  const executeTourAction = async () => {
    if (tourStep === 1) {
      await previewSampleCsvDirectly();
    } else if (tourStep === 2) {
      if (sequence.status !== "approved") {
        await approve();
      }
      setTimeout(() => goToTourStep(3), 800);
    } else if (tourStep === 3) {
      const sampleText = "Maya Chen: 'Sounds great! Can we schedule a 20-min walkthrough this Thursday at 2pm?'";
      setInteraction(sampleText);
      setBusy(true);
      setTimeout(async () => {
        try {
          const r = await fetch("/api/interactions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ accountId: account.id, text: sampleText }),
          });
          const j = await r.json();
          setProposal(
            j.proposal || {
              summary: "Prospect requested a walkthrough on Thursday at 2pm.",
              dealStage: "Demo Scheduled",
              contactStatus: "Interested",
              nextTask: "Schedule 20-min product walkthrough",
              reason: "High buying intent signal detected",
            }
          );
        } catch {
          setProposal({
            summary: "Prospect requested a walkthrough on Thursday at 2pm.",
            dealStage: "Demo Scheduled",
            contactStatus: "Interested",
            nextTask: "Schedule 20-min product walkthrough",
            reason: "High buying intent signal detected",
          });
        } finally {
          setBusy(false);
        }
      }, 500);
    } else if (tourStep === 4) {
      setHandoffs((prev) => prev.map((x, i) => (i === 0 ? { ...x, status: "done" } : x)));
      setTourCelebration(true);
      setTourDockVisible(false);
      localStorage.removeItem("relay_demo_tour_active");
    }
  };

  const nav = [
    { href: "/workspace", label: "Accounts & pipeline", icon: "▦", key: "accounts" },
    { href: "/review", label: "Sequence review", icon: "✳", key: "review" },
    { href: "/handoffs", label: "Handoff queue", icon: "↗", key: "handoffs" },
    { href: "/docs", label: "Documentation", icon: "▤", key: "docs" },
  ];

  return (
    <div className="app-shell">
      {/* Toast Notification */}
      {notice && (
        <button className="toast" onClick={() => setNotice("")}>
          {notice}
          <span>×</span>
        </button>
      )}

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <Link href="/workspace" className="brand">
          <span className="brand-mark">✳</span>
          <span>
            relay<span className="brand-dot">.</span>
            <small>CRM WORKSPACE</small>
          </span>
        </Link>
        <div className="workspace">
          <div className="workspace-icon">R</div>
          <div>
            <b>Relay workspace</b>
            <small>Founder-led sales</small>
          </div>
          <span className="chevron">⌄</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={`nav-item ${screen === n.key ? "active" : ""}`}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
              {n.key === "review" && (
                <em>{accounts.filter((a) => a.sequenceStatus.includes("review")).length}</em>
              )}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-tip">
            <span className="tip-icon">✦</span>
            <b>Your CRM, in motion</b>
            <p>Every workflow keeps account context current and visible.</p>
            <button
              onClick={() => {
                setTourOpen(true);
                setTourDockVisible(true);
              }}
              style={{ background: "none", border: "none", color: "#ffae88", fontWeight: 700, padding: 0, cursor: "pointer", fontSize: "10px" }}
            >
              Start Guided Tour <span>↗</span>
            </button>
          </div>
          <button className="reset-link" onClick={reset}>
            ↻ &nbsp;Reset demo workspace
          </button>
          <div className="profile">
            <div className="avatar avatar-dark">RC</div>
            <div>
              <b>Riley Chen</b>
              <small>Workspace owner</small>
            </div>
            <span className="dots">···</span>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area">
        <header className="topbar">
          <div className="crumb">
            Workspace <span>/</span>{" "}
            {screen === "accounts"
              ? "Accounts & pipeline"
              : screen === "detail"
              ? account.company
              : screen === "review"
              ? "Sequence review"
              : "Handoff queue"}
          </div>
          <div className="top-actions">
            {/* Guided Tour Trigger Button */}
            <button
              className="tour-topbar-pill"
              onClick={() => {
                setTourOpen(true);
                setTourDockVisible(true);
              }}
            >
              <i /> ✦ Guided Demo Tour
            </button>
            <span className="demo-pill">
              <i /> DEMO MODE
            </span>
            <button className="icon-button" title="Notifications">
              ♧<b className="notify-dot" />
            </button>
            <div className="avatar">RC</div>
          </div>
        </header>

        {/* SCREEN 1: ACCOUNTS & PIPELINE */}
        {screen === "accounts" && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">YOUR SALES WORKSPACE</div>
                <h1>
                  Accounts &amp; pipeline<span className="title-period">.</span>
                </h1>
                <p>Keep every relationship moving, without losing the context.</p>
              </div>
              <div className="heading-actions">
                <button
                  className={`btn btn-quiet ${tourDockVisible && tourStep === 1 ? "tour-spotlight-active" : ""}`}
                  onClick={downloadSample}
                >
                  ↓ <span>Sample CSV</span>
                </button>
                <label className={`btn btn-primary ${tourDockVisible && tourStep === 1 ? "tour-spotlight-active" : ""}`}>
                  ＋ Import leads
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">
                  OPEN PIPELINE <span>↗</span>
                </span>
                <b>{money(accounts.reduce((s, a) => s + a.deal.value, 0))}</b>
                <small>
                  <i className="stat-dot orange-dot" />
                  Across {accounts.length} opportunities
                </small>
              </div>
              <div className="stat-card">
                <span className="stat-label">
                  ACTIVE ACCOUNTS <span>↗</span>
                </span>
                <b>{accounts.length.toString().padStart(2, "0")}</b>
                <small>
                  <i className="stat-dot green-dot" />
                  All records up to date
                </small>
              </div>
              <div className="stat-card">
                <span className="stat-label">
                  NEEDS REVIEW <span>↗</span>
                </span>
                <b>
                  {accounts
                    .filter((a) => a.sequenceStatus.toLowerCase().includes("review"))
                    .length.toString()
                    .padStart(2, "0")}
                </b>
                <small>
                  <i className="stat-dot purple-dot" />
                  Outreach awaiting your approval
                </small>
              </div>
              <div className="stat-card stat-highlight">
                <span className="stat-label">
                  HUMAN HANDOFFS <span>↗</span>
                </span>
                <b>
                  {handoffs
                    .filter((h) => h.status === "open")
                    .length.toString()
                    .padStart(2, "0")}
                </b>
                <small>
                  <i className="stat-dot white-dot" />
                  Warm signals ready to action
                </small>
              </div>
            </div>

            <section className="panel pipeline-panel">
              <div className="panel-head">
                <div>
                  <h2>Pipeline overview</h2>
                  <p>Every account, one clear next step.</p>
                </div>
                <label className="search-box">
                  <span>⌕</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search accounts..."
                  />
                  <kbd>⌘ K</kbd>
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ACCOUNT</th>
                      <th>CONTACT</th>
                      <th>STAGE</th>
                      <th>DEAL VALUE</th>
                      <th>NEXT STEP</th>
                      <th>PLAN</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => router.push(`/accounts/${a.id}`)}
                        className="click-row"
                      >
                        <td>
                          <div className="account-cell">
                            <div className={`company-avatar ${a.color}`}>{a.initials}</div>
                            <div>
                              <b>{a.company}</b>
                              <small>{a.domain}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <b className="contact-name">{a.contact.name}</b>
                          <small className="cell-sub">{a.contact.title}</small>
                        </td>
                        <td>
                          <span className={`stage stage-${a.deal.stage.toLowerCase()}`}>
                            {a.deal.stage}
                          </span>
                        </td>
                        <td className="value-cell">{a.deal.value ? money(a.deal.value) : "—"}</td>
                        <td className="next-cell">{a.deal.nextStep}</td>
                        <td>
                          <span
                            className={`plan-state ${
                              a.sequenceStatus.includes("Approved") ? "approved" : ""
                            }`}
                          >
                            <i />
                            {a.sequenceStatus}
                          </span>
                        </td>
                        <td className="row-arrow">↗</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-foot">
                Showing <b>{filtered.length}</b> of <b>{accounts.length}</b> accounts{" "}
                <span>
                  Last synced just now <i />
                </span>
              </div>
            </section>

            <div className="bottom-grid">
              <section className="panel activity-panel">
                <div className="panel-head compact">
                  <div>
                    <h2>Recent activity</h2>
                    <p>The latest changes across your workspace.</p>
                  </div>
                  <Link href="/workspace">View all ↗</Link>
                </div>
                {accounts.slice(0, 3).map((a) => (
                  <div className="activity-row" key={a.id}>
                    <span className="activity-symbol">
                      {a.activities[0]?.type === "Approval" ? "✓" : "↗"}
                    </span>
                    <div>
                      <b>
                        {a.activities[0]?.type} · {a.company}
                      </b>
                      <p>{a.activities[0]?.summary}</p>
                    </div>
                    <small>{a.activities[0]?.when}</small>
                  </div>
                ))}
              </section>

              <section className="workflow-card">
                <div className="workflow-top">
                  <span className="workflow-icon">✦</span>
                  <span className="workflow-label">RELAY WORKFLOW</span>
                  <span className="workflow-live">
                    <i /> READY
                  </span>
                </div>
                <h2>
                  From first touch
                  <br />
                  to real momentum.
                </h2>
                <p>Import a lead, prepare a thoughtful plan, then let new context update your CRM.</p>
                <div className="workflow-steps">
                  <span>
                    <b>01</b> Import
                  </span>
                  <i>→</i>
                  <span>
                    <b>02</b> Review
                  </span>
                  <i>→</i>
                  <span>
                    <b>03</b> Handoff
                  </span>
                </div>
                <Link href="/review">Open sequence review <span>↗</span></Link>
              </section>
            </div>

            {preview && (
              <div className="modal-backdrop">
                <div className="modal">
                  <button className="modal-close" onClick={() => setPreview(false)}>
                    ×
                  </button>
                  <div className="eyebrow">CSV IMPORT</div>
                  <h2>Review before importing</h2>
                  <p>
                    {fileRows.length} valid lead(s) will create linked account, contact, and deal
                    records.
                  </p>
                  <div className="preview-list">
                    {fileRows.slice(0, 5).map((r: any, i: number) => (
                      <div key={i}>
                        <b>{r.company}</b>
                        <span>
                          {r.name} · {r.email}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="modal-actions">
                    <button className="btn btn-quiet" onClick={() => setPreview(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={commitImport}>
                      Import {fileRows.length} leads
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* SCREEN 2: DETAIL (ACCOUNT VIEW) */}
        {screen === "detail" && account && (
          <>
            <div className="back-line">
              <Link href="/workspace">← All accounts</Link>
              <span> / {account.company}</span>
            </div>
            <div className="detail-hero">
              <div className={`company-avatar large ${account.color}`}>{account.initials}</div>
              <div className="detail-title">
                <div className="eyebrow">ACCOUNT RECORD · {account.industry.toUpperCase()}</div>
                <h1>
                  {account.company}
                  <span className="title-period">.</span>
                </h1>
                <a href={`https://${account.domain}`} target="_blank" rel="noreferrer">
                  ↗ {account.domain}
                </a>
              </div>
              <div className="detail-actions">
                <span className={`stage stage-${account.deal.stage.toLowerCase()}`}>
                  {account.deal.stage}
                </span>
                <Link href="/review" className="btn btn-primary">
                  ✦ Review outreach
                </Link>
              </div>
            </div>

            <div className="detail-columns">
              <div className="detail-main">
                <section className="panel info-panel">
                  <div className="panel-head compact">
                    <div>
                      <h2>Account overview</h2>
                      <p>Context your team can build on.</p>
                    </div>
                    <span className="source-chip">● USER SUPPLIED</span>
                  </div>
                  <p className="account-summary">{account.summary}</p>
                  <div className="record-facts">
                    <div>
                      <small>INDUSTRY</small>
                      <b>{account.industry}</b>
                    </div>
                    <div>
                      <small>ACCOUNT DOMAIN</small>
                      <b>{account.domain}</b>
                    </div>
                    <div>
                      <small>CONTEXT SOURCE</small>
                      <b>{account.sourceNotes}</b>
                    </div>
                  </div>
                </section>

                <section className="panel contact-panel">
                  <div className="panel-head compact">
                    <div>
                      <h2>Key contact</h2>
                      <p>The person behind the opportunity.</p>
                    </div>
                    <span className="status-chip">● {account.contact.status}</span>
                  </div>
                  <div className="contact-card">
                    <div className="avatar contact-avatar">
                      {account.contact.name
                        .split(" ")
                        .map((x) => x[0])
                        .join("")}
                    </div>
                    <div>
                      <b>{account.contact.name}</b>
                      <span>{account.contact.title}</span>
                      <a href={`mailto:${account.contact.email}`}>{account.contact.email}</a>
                    </div>
                    <button className="icon-button" title="Email contact">
                      ↗
                    </button>
                  </div>
                </section>

                <section className={`panel interaction-panel ${tourDockVisible && tourStep === 3 ? "tour-spotlight-active" : ""}`}>
                  <div className="panel-head compact">
                    <div>
                      <h2>Log a conversation</h2>
                      <p>Simulate an inbound reply or add a call note.</p>
                    </div>
                    <span className="source-chip">SIMULATED</span>
                  </div>
                  <textarea
                    value={interaction}
                    onChange={(e) => setInteraction(e.target.value)}
                    placeholder="Example: Maya replied that the team is interested and asked to schedule a walkthrough next week."
                  />
                  <div className="interaction-actions">
                    <span>Nothing is sent externally.</span>
                    <button
                      className="btn btn-dark"
                      disabled={busy || interaction.trim().length < 3}
                      onClick={analyze}
                    >
                      {busy ? "Preparing…" : "Prepare CRM update →"}
                    </button>
                  </div>

                  {proposal && (
                    <div className="proposal">
                      <div className="proposal-head">
                        <b>Proposed CRM update</b>
                        <span className="source-chip">DEMO SUGGESTION · REVIEW REQUIRED</span>
                      </div>
                      <p>{proposal.summary}</p>
                      <div className="proposal-change">
                        <span>
                          Contact <b>{proposal.contactStatus}</b>
                        </span>
                        <span>
                          Deal <b>{proposal.dealStage}</b>
                        </span>
                        <span>
                          Next step <b>{proposal.nextTask}</b>
                        </span>
                      </div>
                      <p className="reason">{proposal.reason}</p>
                      <button className="btn btn-primary" onClick={acceptProposal}>
                        Confirm and update CRM
                      </button>
                    </div>
                  )}
                </section>
              </div>

              <div className="detail-aside">
                <section className="panel deal-panel">
                  <div className="panel-head compact">
                    <div>
                      <h2>Opportunity</h2>
                      <p>Active deal record</p>
                    </div>
                    <span className="deal-dots">···</span>
                  </div>
                  <small className="deal-name-label">DEAL NAME</small>
                  <b className="deal-name">{account.deal.name}</b>
                  <div className="deal-value">
                    {account.deal.value ? money(account.deal.value) : "—"}
                    <small>EST. VALUE</small>
                  </div>
                  <div className="deal-progress">
                    <span className="done" />
                    <span className={account.deal.stage !== "Prospecting" ? "done" : ""} />
                    <span
                      className={
                        ["Qualified", "Engaged", "Proposal"].includes(account.deal.stage)
                          ? "done"
                          : ""
                      }
                    />
                    <span />
                  </div>
                  <div className="progress-labels">
                    <span>Prospecting</span>
                    <span>Qualified</span>
                    <span>Proposal</span>
                    <span>Won</span>
                  </div>
                  <div className="next-step-box">
                    <small>NEXT STEP</small>
                    <b>{account.deal.nextStep}</b>
                  </div>
                  <Link className="deal-link" href="/review">
                    {account.sequenceStatus} <span>↗</span>
                  </Link>
                </section>

                <section className="panel timeline-panel">
                  <div className="panel-head compact">
                    <div>
                      <h2>Activity timeline</h2>
                      <p>A clear record of every change.</p>
                    </div>
                    <span className="timeline-count">{account.activities.length}</span>
                  </div>
                  <div className="timeline">
                    {account.activities.map((a, i) => (
                      <div className="timeline-entry" key={a.id}>
                        <span className={`timeline-marker ${i === 0 ? "current" : ""}`}>
                          {a.type === "Approval" ? "✓" : a.type === "Interaction" ? "↙" : "·"}
                        </span>
                        <div>
                          <b>{a.type}</b>
                          <p>{a.summary}</p>
                          <small>
                            {a.when} · {a.source}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}

        {/* SCREEN 3: SEQUENCE REVIEW (HUMAN IN THE LOOP) */}
        {screen === "review" && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">HUMAN IN THE LOOP</div>
                <h1>
                  Sequence review<span className="title-period">.</span>
                </h1>
                <p>Review every message before it enters your workflow.</p>
              </div>
              <div className="heading-actions">
                <span className="review-count">
                  <i />{" "}
                  {
                    accounts.filter(
                      (a) => !sequences[a.id] || sequences[a.id].status === "draft"
                    ).length
                  }{" "}
                  awaiting review
                </span>
              </div>
            </div>

            <div className="review-layout">
              <div className="review-list panel">
                <div className="panel-head compact">
                  <div>
                    <h2>Accounts to review</h2>
                    <p>Choose a plan to inspect.</p>
                  </div>
                </div>
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    className={`review-account ${a.id === account.id ? "selected" : ""}`}
                    onClick={() => setSelectedAccountId(a.id)}
                  >
                    <span className={`company-avatar ${a.color}`}>{a.initials}</span>
                    <span>
                      <b>{a.company}</b>
                      <small>
                        {a.contact.name} · {a.sequenceStatus}
                      </small>
                    </span>
                    <span>›</span>
                  </button>
                ))}
              </div>

              <div className="sequence-detail panel">
                <div className="sequence-heading">
                  <div>
                    <div className="eyebrow">PERSONALIZED OUTREACH PLAN</div>
                    <h2>{account.company}</h2>
                    <p>
                      To {account.contact.name} · {account.contact.title}
                    </p>
                  </div>
                  <span className={`sequence-status ${sequence.status}`}>
                    ● {sequence.status === "approved" ? "APPROVED" : "DRAFT · REVIEW REQUIRED"}
                  </span>
                </div>

                <div className="rationale">
                  <span>✦</span>
                  <div>
                    <b>Why this approach</b>
                    <p>{sequence.rationale}</p>
                    <small>Context: {account.sourceNotes} · Grounded facts, zero hallucinations</small>
                  </div>
                </div>

                <div className="sequence-disclaimer">
                  ✳ &nbsp;Draft only. Approving records your decision and schedules workflow tracking.
                  No message will be sent.
                </div>

                {sequence.steps.map((s, i) => (
                  <div className="sequence-step" key={i}>
                    <div className="step-rail">
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <i />
                    </div>
                    <div className="step-content">
                      <div className="step-top">
                        <b>Email · {s.delay === 0 ? "Day 1" : `Day ${s.delay + 1}`}</b>
                        <span>✎ EDIT DRAFT</span>
                      </div>
                      <label>
                        SUBJECT
                        <input
                          value={s.subject}
                          onChange={(e) =>
                            setSequence({
                              ...sequence,
                              steps: sequence.steps.map((x, j) =>
                                i === j ? { ...x, subject: e.target.value } : x
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        MESSAGE
                        <textarea
                          value={s.body}
                          onChange={(e) =>
                            setSequence({
                              ...sequence,
                              steps: sequence.steps.map((x, j) =>
                                i === j ? { ...x, body: e.target.value } : x
                              ),
                            })
                          }
                        />
                      </label>
                      <div className="step-rationale">
                        <b>Rationale</b>
                        <span>{s.rationale}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="sequence-footer">
                  <span>
                    ✦ &nbsp;
                    {sequences[account.id]
                      ? "AI output · source-labeled & validated"
                      : "Demo fixture · validated structured output"}
                  </span>
                  <div className="sequence-buttons">
                    <button
                      className="btn btn-quiet"
                      disabled={busy || sequence.status === "approved"}
                      onClick={makeSequence}
                    >
                      {busy ? "Generating…" : "✦ Generate draft"}
                    </button>
                    <button
                      className={`btn btn-primary ${
                        tourDockVisible && tourStep === 2 ? "tour-spotlight-active" : ""
                      }`}
                      disabled={sequence.status === "approved"}
                      onClick={approve}
                    >
                      {sequence.status === "approved" ? "✓ Approved · scheduled" : "Approve plan →"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* SCREEN 4: HANDOFFS QUEUE */}
        {screen === "handoffs" && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">HUMAN FOLLOW-UP</div>
                <h1>
                  Handoff queue<span className="title-period">.</span>
                </h1>
                <p>Warm signals become clear next steps for your team.</p>
              </div>
              <div className="heading-actions">
                <span className="review-count">
                  <i className="green-dot" />{" "}
                  {handoffs.filter((h) => h.status === "open").length} open handoffs
                </span>
              </div>
            </div>

            <section className="panel handoff-panel">
              <div className="panel-head">
                <div>
                  <h2>Ready for a human</h2>
                  <p>Created when you confirm a positive reply or call note.</p>
                </div>
                <span className="source-chip">NO AUTO-SENDING</span>
              </div>
              {handoffs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">↗</div>
                  <h3>No handoffs yet</h3>
                  <p>
                    When a prospect shows interest, confirm the proposed CRM update on their account.
                    Relay will add a task here.
                  </p>
                  <Link href={`/accounts/${accounts[0]?.id || "northstar"}`} className="btn btn-primary">
                    Open a demo account
                  </Link>
                </div>
              ) : (
                <div className="handoff-list">
                  {handoffs.map((h, i) => (
                    <div
                      className={`handoff-row ${
                        tourDockVisible && tourStep === 4 && i === 0 ? "tour-spotlight-active" : ""
                      }`}
                      key={`${h.accountId}-${i}`}
                    >
                      <span className="handoff-icon">✦</span>
                      <div className="handoff-main">
                        <div className="handoff-title">
                          <b>{h.reason}</b>
                          <span className="priority">WARM SIGNAL</span>
                        </div>
                        <p>
                          <Link href={`/accounts/${h.accountId}`}>{h.company}</Link> · {h.contact}
                        </p>
                        <small>
                          Suggested task · {h.due} · Created from confirmed simulated interaction
                        </small>
                      </div>
                      <button
                        className="btn btn-quiet"
                        onClick={() =>
                          setHandoffs((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, status: "done" } : x))
                          )
                        }
                      >
                        {h.status === "done" ? "✓ Done" : "Mark done"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <footer className="footer">
          Relay CRM <span>·</span> Demo workspace <span>·</span> Simulated workflows are labeled and
          never sent
        </footer>
      </main>

      {/* BIGTECH ONBOARDING 1: WELCOME MODAL */}
      {tourOpen && (
        <div className="tour-modal-backdrop">
          <div className="tour-welcome-modal">
            <span className="tour-badge">✦ GUIDED DEMO TOUR · 2-MINUTE ONBOARDING</span>
            <h2>Welcome to the Relay CRM Demo</h2>
            <p className="tour-intro">
              Relay is an AI-native CRM for founder-led sales teams. Experience how the complete outbound
              loop functions without manual bookkeeping:
            </p>

            <div className="tour-steps-grid">
              <div className="tour-step-card">
                <div className="tour-step-top">
                  <span className="tour-step-num">01 · INGEST LEADS</span>
                  <span className="tour-step-icon">📥</span>
                </div>
                <b>Lead CSV Ingestion</b>
                <p>Upload raw lists to generate structured Account, Contact, and Deal records automatically.</p>
              </div>

              <div className="tour-step-card">
                <div className="tour-step-top">
                  <span className="tour-step-num">02 · HUMAN IN THE LOOP</span>
                  <span className="tour-step-icon">✍️</span>
                </div>
                <b>Review Outreach Sequences</b>
                <p>AI writes 3-touch emails tailored to pain points. You retain full approval before anything moves.</p>
              </div>

              <div className="tour-step-card">
                <div className="tour-step-top">
                  <span className="tour-step-num">03 · SIGNAL DETECTION</span>
                  <span className="tour-step-icon">⚡</span>
                </div>
                <b>Inbound Reply Analysis</b>
                <p>Prospect shows interest. AI extracts intent and proposes advancing deal stage to Demo Scheduled.</p>
              </div>

              <div className="tour-step-card">
                <div className="tour-step-top">
                  <span className="tour-step-num">04 · WARM HANDOFF</span>
                  <span className="tour-step-icon">🤝</span>
                </div>
                <b>Automated Sales Handoff</b>
                <p>High-priority tasks created for your team with full conversation context and audit trail.</p>
              </div>
            </div>

            <div className="tour-modal-actions">
              <button className="tour-reset-btn" onClick={reset}>
                ↻ Reset Demo Workspace
              </button>
              <div className="tour-modal-buttons">
                <button className="tour-btn-quiet" onClick={closeTourWelcome}>
                  Explore on my own
                </button>
                <button className="tour-btn-primary" onClick={startTourFromWelcome}>
                  Start Guided Walkthrough ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BIGTECH ONBOARDING 2: FLOATING INTERACTIVE TOUR DOCK */}
      {tourDockVisible && !tourOpen && (
        <>
          {tourMinimized ? (
            <div
              className="tour-dock-minimized"
              onClick={() => setTourMinimized(false)}
              title="Click to expand Demo Tour"
            >
              <span>
                <i>✦</i> Demo Tour (Step {tourStep} of 4)
              </span>
              <small style={{ color: "#a1a1aa" }}>[Expand ↗]</small>
            </div>
          ) : (
            <div className="tour-dock">
              <div className="tour-dock-bar">
                <div
                  className="tour-dock-progress"
                  style={{ width: `${(tourStep / 4) * 100}%` }}
                />
              </div>

              <div className="tour-dock-header">
                <span>
                  <i>✦</i> Step {tourStep} of 4 ·{" "}
                  {tourStep === 1
                    ? "Ingest Leads"
                    : tourStep === 2
                    ? "Approve Outreach"
                    : tourStep === 3
                    ? "Inbound Signal"
                    : "Warm Handoff"}
                </span>
                <div className="tour-dock-controls">
                  <button
                    className="tour-dock-btn"
                    onClick={() => setTourMinimized(true)}
                    title="Minimize"
                  >
                    −
                  </button>
                  <button
                    className="tour-dock-btn"
                    onClick={() => {
                      setTourDockVisible(false);
                      localStorage.removeItem("relay_demo_tour_active");
                    }}
                    title="Dismiss Tour"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="tour-dock-body">
                {tourStep === 1 && (
                  <>
                    <div className="tour-dock-title">01 · Ingest &amp; Parse Leads</div>
                    <p className="tour-dock-desc">
                      Relay parses raw CSV leads into connected Account, Contact, and Deal records with
                      source-grounded facts.
                    </p>
                    <button className="tour-dock-action-btn" onClick={executeTourAction}>
                      📥 Preview Sample Leads CSV
                    </button>
                  </>
                )}

                {tourStep === 2 && (
                  <>
                    <div className="tour-dock-title">02 · Human-in-the-Loop Approval</div>
                    <p className="tour-dock-desc">
                      Every AI-generated sequence draft is held for operator approval. Nothing is sent
                      externally without consent.
                    </p>
                    <button className="tour-dock-action-btn" onClick={executeTourAction}>
                      ✍️ Approve Sequence Plan Now
                    </button>
                  </>
                )}

                {tourStep === 3 && (
                  <>
                    <div className="tour-dock-title">03 · Detect Inbound Buying Signals</div>
                    <p className="tour-dock-desc">
                      Simulate a prospect reply. AI evaluates positive intent and proposes moving deal to
                      Demo Scheduled.
                    </p>
                    <button className="tour-dock-action-btn" onClick={executeTourAction}>
                      ⚡ Simulate Prospect Demo Request
                    </button>
                  </>
                )}

                {tourStep === 4 && (
                  <>
                    <div className="tour-dock-title">04 · Automated Warm Handoff</div>
                    <p className="tour-dock-desc">
                      Confirmed positive signals advance deal stages and generate prioritized tasks in
                      the sales handoff queue.
                    </p>
                    <button className="tour-dock-action-btn" onClick={executeTourAction}>
                      🤝 Complete Handoff &amp; Finish Tour
                    </button>
                  </>
                )}

                <div className="tour-dock-footer">
                  <div className="tour-dock-nav">
                    <button
                      className="tour-nav-btn"
                      disabled={tourStep === 1}
                      onClick={() => goToTourStep(tourStep - 1)}
                    >
                      ← Prev
                    </button>
                    {tourStep < 4 ? (
                      <button
                        className="tour-nav-btn tour-nav-next"
                        onClick={() => goToTourStep(tourStep + 1)}
                      >
                        Next Step ➔
                      </button>
                    ) : (
                      <button
                        className="tour-nav-btn tour-nav-next"
                        onClick={() => {
                          setTourCelebration(true);
                          setTourDockVisible(false);
                          localStorage.removeItem("relay_demo_tour_active");
                        }}
                      >
                        Finish 🎉
                      </button>
                    )}
                  </div>
                  <button
                    style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "11px", cursor: "pointer" }}
                    onClick={reset}
                  >
                    ↻ Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* BIGTECH ONBOARDING 3: CELEBRATION MODAL */}
      {tourCelebration && (
        <div className="tour-modal-backdrop">
          <div className="tour-welcome-modal" style={{ textAlign: "center", maxWidth: "560px" }}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>🏆</div>
            <span className="tour-badge" style={{ background: "#ecfdf5", color: "#059669" }}>
              ALL 4 WORKFLOWS VERIFIED
            </span>
            <h2>Outbound Loop Successfully Completed!</h2>
            <p className="tour-intro">
              You’ve experienced the end-to-end Relay CRM loop: Ingestion ➔ Grounded Account Brief ➔
              Human Approval ➔ Inbound Intent Analysis ➔ Warm Handoff Queue.
            </p>

            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
                textAlign: "left",
                marginBottom: "24px",
                display: "grid",
                gap: "8px",
                fontSize: "13px",
              }}
            >
              <div style={{ color: "#059669", fontWeight: 600 }}>✓ 01 · Lead Ingestion &amp; Sourced Briefs Verified</div>
              <div style={{ color: "#059669", fontWeight: 600 }}>✓ 02 · Human-in-the-Loop Sequence Approval Verified</div>
              <div style={{ color: "#059669", fontWeight: 600 }}>✓ 03 · Inbound Signal Intent Detection Verified</div>
              <div style={{ color: "#059669", fontWeight: 600 }}>✓ 04 · Automated Warm Handoff &amp; Audit Trail Verified</div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                className="tour-btn-quiet"
                onClick={async () => {
                  await reset();
                  setTourCelebration(false);
                  setTourStep(1);
                  setTourDockVisible(true);
                  router.push("/workspace");
                }}
              >
                ↻ Reset Demo &amp; Play Again
              </button>
              <Link href="/docs" className="tour-btn-primary">
                📘 View API Docs ↗
              </Link>
              <button
                className="tour-btn-quiet"
                onClick={() => setTourCelebration(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
