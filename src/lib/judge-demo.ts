// Relay CRM — 30-Second Autonomous AI Rearrangement Demo for Judges
// Showcases how AI autonomously researches leads and dynamically rearranges
// customer relationships and workflow graphs as status changes, while keeping human approval intact.

export interface JudgeDemoState {
  step: number; // 1 to 4
  timerSeconds: number; // 30 down to 0
  isRunning: boolean;
  isCompleted: boolean;
}

let activeInterval: ReturnType<typeof setInterval> | null = null;
let currentStep = 1;
let remainingSeconds = 30;
let isPlaying = true;

export function isJudgeDemoRequested(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("demo") || params.has("tour");
}

export function openJudgeDemo(): void {
  currentStep = 1;
  remainingSeconds = 30;
  isPlaying = true;
  renderJudgeDemoModal();
  startTimer();
}

export function closeJudgeDemo(): void {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  const modal = document.getElementById("judge-demo-backdrop");
  if (modal) modal.remove();

  // Clean URL query param without full page reload
  if (typeof window !== "undefined" && window.history) {
    const url = new URL(window.location.href);
    url.searchParams.delete("demo");
    url.searchParams.delete("tour");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
}

function startTimer(): void {
  if (activeInterval) clearInterval(activeInterval);
  activeInterval = setInterval(() => {
    if (!isPlaying) return;
    remainingSeconds = Math.max(0, remainingSeconds - 1);

    // Auto-advance steps at key timing checkpoints
    if (remainingSeconds === 22 && currentStep === 1) {
      currentStep = 2; // Wow moment: Autonomous rearrangement
    } else if (remainingSeconds === 12 && currentStep === 2) {
      currentStep = 3; // Human approval checkpoint
    } else if (remainingSeconds === 0) {
      currentStep = 4; // Complete / Summary
      isPlaying = false;
      if (activeInterval) clearInterval(activeInterval);
    }
    updateModalContent();
  }, 1000);
}

function setStep(step: number): void {
  currentStep = step;
  if (step === 1) remainingSeconds = 30;
  else if (step === 2) remainingSeconds = 22;
  else if (step === 3) remainingSeconds = 12;
  else if (step === 4) {
    remainingSeconds = 0;
    isPlaying = false;
  }
  updateModalContent();
}

function togglePlay(): void {
  isPlaying = !isPlaying;
  const playBtn = document.getElementById("demo-play-btn");
  if (playBtn) playBtn.textContent = isPlaying ? "⏸ Pause" : "▶ Play";
}

export function renderJudgeDemoModal(): void {
  let modal = document.getElementById("judge-demo-backdrop");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "judge-demo-backdrop";
    modal.className = "judge-demo-backdrop";
    document.body.appendChild(modal);
  }
  updateModalContent();
}

function updateModalContent(): void {
  const modal = document.getElementById("judge-demo-backdrop");
  if (!modal) return;

  const progressPercent = Math.min(100, Math.round(((30 - remainingSeconds) / 30) * 100));

  modal.innerHTML = `
    <div class="judge-demo-modal" role="dialog" aria-modal="true">
      <!-- Modal Top Bar -->
      <div class="judge-demo-head">
        <div class="judge-demo-badge">
          <span class="pulse-dot"></span>
          <strong>30s JUDGE EVALUATION DEMO</strong>
          <span class="timer-pill">00:${String(remainingSeconds).padStart(2, "0")}</span>
        </div>
        <div class="judge-demo-controls">
          <button class="judge-ctrl-btn" id="demo-play-btn" title="Toggle autoplay">
            ${isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button class="judge-close-btn" id="demo-close-btn" aria-label="Close demo">×</button>
        </div>
      </div>

      <!-- Linear Progress Bar -->
      <div class="judge-progress-bar">
        <div class="judge-progress-fill" style="width: ${progressPercent}%;"></div>
      </div>

      <!-- Step Navigation Tabs -->
      <div class="judge-step-tabs">
        <button class="judge-tab ${currentStep === 1 ? "active" : currentStep > 1 ? "done" : ""}" data-step="1">
          <i>1</i> <span>Grounded Research</span>
        </button>
        <button class="judge-tab ${currentStep === 2 ? "active" : currentStep > 2 ? "done" : ""}" data-step="2">
          <i>2</i> <span>Autonomous Rearrangement ⚡</span>
        </button>
        <button class="judge-tab ${currentStep === 3 ? "active" : currentStep > 3 ? "done" : ""}" data-step="3">
          <i>3</i> <span>Human Approval Gate</span>
        </button>
        <button class="judge-tab ${currentStep === 4 ? "active" : ""}" data-step="4">
          <i>4</i> <span>Self-Updating CRM</span>
        </button>
      </div>

      <!-- Dynamic Step Body -->
      <div class="judge-step-body">
        ${renderStepBody(currentStep)}
      </div>

      <!-- Modal Footer -->
      <div class="judge-demo-foot">
        <div class="judge-foot-status">
          ${
            currentStep === 1
              ? "<span>🔍 Agent: Gathering grounded public & tech signals...</span>"
              : currentStep === 2
                ? "<span class='highlight-text'>⚡ <strong>WOW MOMENT:</strong> AI autonomously restructured relationship & pipeline value!</span>"
                : currentStep === 3
                  ? "<span>🛡 <strong>Relay Guardrail:</strong> AI plans autonomously; human approval stays with you.</span>"
                  : "<span>✓ <strong>Loop Complete:</strong> All records updated with zero manual bookkeeping.</span>"
          }
        </div>
        <div class="judge-foot-actions">
          ${
            currentStep > 1
              ? `<button class="button secondary mini-button" id="demo-prev-btn">← Back</button>`
              : ""
          }
          ${
            currentStep < 4
              ? `<button class="button primary" id="demo-next-btn">Next Step →</button>`
              : `<button class="button primary" id="demo-finish-btn">Explore Live CRM ↗</button>`
          }
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  document.getElementById("demo-close-btn")?.addEventListener("click", closeJudgeDemo);
  document.getElementById("demo-play-btn")?.addEventListener("click", togglePlay);
  document.getElementById("demo-prev-btn")?.addEventListener("click", () => setStep(currentStep - 1));
  document.getElementById("demo-next-btn")?.addEventListener("click", () => setStep(currentStep + 1));
  document.getElementById("demo-finish-btn")?.addEventListener("click", closeJudgeDemo);

  document.querySelectorAll<HTMLButtonElement>(".judge-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetStep = Number(tab.dataset.step || 1);
      setStep(targetStep);
    });
  });

  const approveDemoBtn = document.getElementById("judge-approve-action");
  if (approveDemoBtn) {
    approveDemoBtn.addEventListener("click", () => {
      approveDemoBtn.innerHTML = "Approved ✓ (Syncing to CRM...)";
      (approveDemoBtn as HTMLButtonElement).disabled = true;
      setTimeout(() => setStep(4), 600);
    });
  }
}

function renderStepBody(step: number): string {
  switch (step) {
    case 1:
      return `
        <div class="judge-panel-grid">
          <div class="judge-card">
            <div class="judge-card-header">
              <span class="eyebrow">TARGET ACCOUNT</span>
              <h3>Northwind Analytics</h3>
              <p class="muted">VP of Sales: Avery Chen · <code>northwind.ai</code></p>
            </div>
            <div class="judge-tag-row">
              <span class="stage prospecting">Prospecting · Cold</span>
              <span class="deal-tag">$24,000 Initial Value</span>
            </div>
            <div class="research-feed">
              <div class="feed-item active">
                <span class="feed-bullet">●</span>
                <div>
                  <b>Grounded Public Filings & Web Search</b>
                  <p>Northwind expanding sales dev from 4 to 12 reps this quarter.</p>
                </div>
              </div>
              <div class="feed-item active">
                <span class="feed-bullet">●</span>
                <div>
                  <b>Tech Stack Telemetry</b>
                  <p>Migrated from legacy sales stack; experiencing 35% rep bookkeeping fatigue.</p>
                </div>
              </div>
              <div class="feed-item active">
                <span class="feed-bullet">●</span>
                <div>
                  <b>Decision Maker Context</b>
                  <p>Avery Chen publicly prioritizes strict human approval over raw auto-send bots.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="judge-card visual-card">
            <span class="eyebrow">AUTONOMOUS RESEARCH INSIGHT</span>
            <div class="insight-big-box">
              <div class="insight-score">
                <b>96%</b>
                <small>BUYING SIGNAL CONFIDENCE</small>
              </div>
              <h4>Key Strategic Opportunity</h4>
              <p>Position Relay’s <em>human-in-the-loop approval guardrails</em> directly against uncontrolled AI spam tools.</p>
              <div class="source-chip-row">
                <span class="source-chip">100% Sourced</span>
                <span class="source-chip">Gemini 2.5 Flash</span>
                <span class="source-chip">Zod Grounded</span>
              </div>
            </div>
          </div>
        </div>
      `;

    case 2:
      return `
        <div class="judge-wow-container">
          <div class="wow-alert">
            <div class="wow-pulse">⚡</div>
            <div>
              <strong>INCOMING RELATIONSHIP SIGNAL DETECTED:</strong>
              <p>“Prospect replied on LinkedIn: <em>‘We are reviewing outbound systems next Tuesday, but cannot have AI email candidates without executive sign-off.’</em>”</p>
            </div>
          </div>

          <!-- The Rearranged Workflow Canvas -->
          <div class="workflow-rearrange-box">
            <div class="workflow-rearrange-head">
              <div>
                <span class="eyebrow">AUTONOMOUS WORKFLOW REARRANGEMENT</span>
                <h3>AI dynamically reconstructed the customer relationship</h3>
              </div>
              <div class="rearrange-stats">
                <span class="stage engaged">Stage: Engaged ↗</span>
                <span class="deal-tag-boost">$48,000 (Doubled from $24k)</span>
              </div>
            </div>

            <!-- Dynamic Graph Visual -->
            <div class="dynamic-graph-nodes">
              <div class="graph-node-card done">
                <small>01 · COMPLETED</small>
                <b>Deep Lead Research</b>
                <span>3 grounded facts verified</span>
              </div>
              <div class="graph-arrow">→</div>
              <div class="graph-node-card replaced">
                <small>02 · AUTONOMOUSLY DISMANTLED</small>
                <b class="strikethrough">Generic Cold Outreach</b>
                <span class="badge-superseded">Superseded by inbound reply</span>
              </div>
              <div class="graph-arrow">→</div>
              <div class="graph-node-card new-node pulse">
                <small>03 · AUTONOMOUSLY INJECTED</small>
                <b>Security & Approval Brief</b>
                <span>Tailored to Avery's 12-rep SDR governance</span>
              </div>
              <div class="graph-arrow">→</div>
              <div class="graph-node-card gate">
                <small>04 · MANDATORY GATE</small>
                <b>Human Sign-Off</b>
                <span>Approval stays with team</span>
              </div>
            </div>

            <p class="rearrange-caption">
              ✳ <em>Notice how the AI autonomously restructured the entire deal strategy and workflow graph without any manual CRM editing.</em>
            </p>
          </div>
        </div>
      `;

    case 3:
      return `
        <div class="judge-panel-grid">
          <div class="judge-card">
            <div class="judge-card-header">
              <span class="eyebrow">HUMAN-IN-THE-LOOP CHECKPOINT</span>
              <h3>Review Proposed 3-Step Strategy</h3>
              <p class="muted">No external email or LinkedIn message is sent without your click.</p>
            </div>

            <div class="sequence-mini-preview">
              <div class="mini-step">
                <span class="step-num">Touch 1</span>
                <div>
                  <b>Subject: Human approval guardrails for Northwind's 12-rep SDR team</b>
                  <p>Hi Avery, saw Northwind is scaling SDRs. Traditional AI spam burns sender domains; Relay prepares context-rich drafts but gives you 1-click approval before anything moves...</p>
                </div>
              </div>
              <div class="mini-step">
                <span class="step-num">Touch 2</span>
                <div>
                  <b>Day 3: Architecture diagram for automated CRM sync</b>
                  <p>Following up with our 1-page architecture showing how reply sentiment auto-creates AE handoffs...</p>
                </div>
              </div>
            </div>
          </div>

          <div class="judge-card decision-card">
            <span class="eyebrow">YOUR DECISION</span>
            <h3>Approve or adjust before execution</h3>
            <p class="muted">Every decision writes an immutable entry into Relay's audit timeline.</p>
            <div class="decision-actions">
              <button class="button primary large-btn" id="judge-approve-action">
                Approve Autonomous Plan ✓
              </button>
              <button class="button secondary" id="judge-custom-action" onclick="alert('In the live workspace, you can edit every step or drag-and-drop workflow nodes!')">
                ✎ Customize Steps
              </button>
            </div>
            <small class="decision-note">Clicking approve will log the audit trail and advance to live CRM state.</small>
          </div>
        </div>
      `;

    case 4:
      return `
        <div class="judge-summary-card">
          <div class="summary-check">✓</div>
          <h2>30-Second Autonomous Loop Complete!</h2>
          <p class="summary-intro">
            In less than 30 seconds, Relay transformed a raw lead list into deep grounded research, autonomously rearranged the customer relationship when status changed, doubled the pipeline value, and secured human approval.
          </p>

          <div class="summary-grid">
            <div class="summary-stat">
              <small>PIPELINE RESTRUCTURED</small>
              <b>$48,000</b>
              <span>From initial $24,000</span>
            </div>
            <div class="summary-stat">
              <small>MANUAL ADMIN TIME</small>
              <b>0 min</b>
              <span>Saved 45 min per lead</span>
            </div>
            <div class="summary-stat">
              <small>SAFETY GUARDRAILS</small>
              <b>100%</b>
              <span>Zero unapproved actions</span>
            </div>
            <div class="summary-stat">
              <small>IMMUTABLE AUDIT</small>
              <b>#aud_984f1</b>
              <span>Logged to Supabase</span>
            </div>
          </div>

          <div class="summary-actions">
            <button class="button primary" id="demo-finish-btn" onclick="document.getElementById('demo-close-btn').click()">
              Explore the Live Workspace ↗
            </button>
            <button class="button secondary" onclick="window.relayReplayDemo()">
              ↻ Replay 30s Demo
            </button>
          </div>
        </div>
      `;

    default:
      return "";
  }
}

// Global hook for replaying demo
if (typeof window !== "undefined") {
  (window as any).relayReplayDemo = () => {
    openJudgeDemo();
  };
  (window as any).relayOpenJudgeDemo = openJudgeDemo;
}
