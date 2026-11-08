// Relay CRM — Classic 2-Minute Guided Tour (Restored)
// Brings back the original 4-step interactive floating tour dock, welcome modal, and celebration modal.

import { toHref } from "../workspace";

let tourStep = 1;
let isTourDockVisible = false;
let isTourMinimized = false;
let isTourWelcomeOpen = false;
let isCelebrationOpen = false;

export function openClassicTour(): void {
  tourStep = 1;
  isTourWelcomeOpen = true;
  isTourDockVisible = false;
  isCelebrationOpen = false;
  renderClassicTour();
}

export function startTourFromWelcome(): void {
  isTourWelcomeOpen = false;
  isTourDockVisible = true;
  isTourMinimized = false;
  tourStep = 1;
  renderClassicTour();
}

export function closeClassicTour(): void {
  isTourWelcomeOpen = false;
  isTourDockVisible = false;
  isCelebrationOpen = false;
  const container = document.getElementById("classic-tour-container");
  if (container) container.innerHTML = "";
}

export function goToStep(step: number): void {
  tourStep = Math.max(1, Math.min(4, step));
  renderClassicTour();

  // Navigate to corresponding page if needed
  if (tourStep === 1) {
    if (window.location.pathname.endsWith("/accounts") || window.location.pathname.endsWith("/workspace")) {
      // already there
    } else {
      window.location.href = toHref("/accounts");
    }
  } else if (tourStep === 2) {
    window.location.href = toHref("/automations");
  } else if (tourStep === 3) {
    window.location.href = toHref("/pipeline");
  } else if (tourStep === 4) {
    window.location.href = toHref("/tasks");
  }
}

export function executeClassicTourAction(): void {
  if (tourStep === 1) {
    // Action 1: Load sample CSV
    const loadSampleBtn = document.getElementById("load-sample") as HTMLButtonElement | null;
    if (loadSampleBtn) {
      loadSampleBtn.click();
    } else {
      goToStep(2);
    }
  } else if (tourStep === 2) {
    // Action 2: Approve sequence
    const approveBtn = document.getElementById("approve-sequence") as HTMLButtonElement | null;
    if (approveBtn && !approveBtn.disabled) {
      approveBtn.click();
    }
    setTimeout(() => goToStep(3), 600);
  } else if (tourStep === 3) {
    // Action 3: Inbound signal
    goToStep(4);
  } else if (tourStep === 4) {
    // Action 4: Finish tour & celebrate
    isTourDockVisible = false;
    isCelebrationOpen = true;
    renderClassicTour();
  }
}

export function renderClassicTour(): void {
  let container = document.getElementById("classic-tour-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "classic-tour-container";
    document.body.appendChild(container);
  }

  let html = "";

  // 1. WELCOME MODAL
  if (isTourWelcomeOpen) {
    html += `
      <div class="tour-modal-backdrop">
        <div class="tour-welcome-modal">
          <span class="tour-badge">✦ GUIDED DEMO TOUR · 2-MINUTE ONBOARDING</span>
          <h2>Welcome to the Relay CRM Demo</h2>
          <p class="tour-intro">
            Relay is an AI-native CRM for founder-led sales teams. Experience how the complete outbound
            loop functions without manual bookkeeping:
          </p>

          <div class="tour-steps-grid">
            <div class="tour-step-card">
              <div class="tour-step-top">
                <span class="tour-step-num">01 · INGEST LEADS</span>
                <span class="tour-step-icon">📥</span>
              </div>
              <b>Lead CSV Ingestion</b>
              <p>Upload raw lists to generate structured Account, Contact, and Deal records automatically.</p>
            </div>

            <div class="tour-step-card">
              <div class="tour-step-top">
                <span class="tour-step-num">02 · HUMAN IN THE LOOP</span>
                <span class="tour-step-icon">✍️</span>
              </div>
              <b>Review Outreach Sequences</b>
              <p>AI writes 3-touch emails tailored to pain points. You retain full approval before anything moves.</p>
            </div>

            <div class="tour-step-card">
              <div class="tour-step-top">
                <span class="tour-step-num">03 · SIGNAL DETECTION</span>
                <span class="tour-step-icon">⚡</span>
              </div>
              <b>Inbound Reply Analysis</b>
              <p>Prospect shows interest. AI extracts intent and proposes advancing deal stage to Demo Scheduled.</p>
            </div>

            <div class="tour-step-card">
              <div class="tour-step-top">
                <span class="tour-step-num">04 · WARM HANDOFF</span>
                <span class="tour-step-icon">🤝</span>
              </div>
              <b>Automated Sales Handoff</b>
              <p>High-priority tasks created for your team with full conversation context and audit trail.</p>
            </div>
          </div>

          <div class="tour-modal-actions">
            <button class="tour-btn-quiet" id="tour-welcome-close">
              Explore on my own
            </button>
            <button class="tour-btn-primary" id="tour-welcome-start">
              Start Guided Walkthrough ➔
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 2. FLOATING INTERACTIVE TOUR DOCK
  if (isTourDockVisible && !isTourWelcomeOpen) {
    if (isTourMinimized) {
      html += `
        <div class="tour-dock-minimized" id="tour-dock-expand" title="Click to expand Demo Tour">
          <span><i>✦</i> Demo Tour (Step ${tourStep} of 4)</span>
          <small style="color: #a1a1aa">[Expand ↗]</small>
        </div>
      `;
    } else {
      const stepTitles = ["Ingest Leads", "Approve Outreach", "Inbound Signal", "Warm Handoff"];
      const actionLabels = [
        "📥 Preview Sample Leads CSV",
        "✍️ Approve Sequence Plan Now",
        "⚡ Simulate Prospect Reply & Intent",
        "🤝 Complete Handoff & Finish Tour"
      ];
      const descriptions = [
        "Relay parses raw CSV leads into connected Account, Contact, and Deal records with source-grounded facts.",
        "Every AI-generated sequence draft is held for operator approval. Nothing is sent externally without consent.",
        "Simulate a prospect reply. AI evaluates positive intent and proposes moving deal to Demo Scheduled.",
        "Confirmed positive signals advance deal stages and generate prioritized tasks in the sales handoff queue."
      ];

      html += `
        <div class="tour-dock">
          <div class="tour-dock-bar">
            <div class="tour-dock-progress" style="width: ${(tourStep / 4) * 100}%;"></div>
          </div>

          <div class="tour-dock-header">
            <span><i>✦</i> Step ${tourStep} of 4 · ${stepTitles[tourStep - 1]}</span>
            <div class="tour-dock-controls">
              <button class="tour-dock-btn" id="tour-dock-min-btn" title="Minimize">−</button>
              <button class="tour-dock-btn" id="tour-dock-close-btn" title="Dismiss Tour">✕</button>
            </div>
          </div>

          <div class="tour-dock-body">
            <div class="tour-dock-title">0${tourStep} · ${stepTitles[tourStep - 1]}</div>
            <p class="tour-dock-desc">${descriptions[tourStep - 1]}</p>
            <button class="tour-dock-action-btn" id="tour-action-exec-btn">
              ${actionLabels[tourStep - 1]}
            </button>

            <div class="tour-dock-footer">
              <div class="tour-dock-nav">
                <button class="tour-nav-btn" id="tour-nav-prev" ${tourStep === 1 ? "disabled" : ""}>
                  ← Prev
                </button>
                <button class="tour-nav-btn tour-nav-next" id="tour-nav-next">
                  ${tourStep < 4 ? "Next Step ➔" : "Finish 🎉"}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // 3. CELEBRATION MODAL
  if (isCelebrationOpen) {
    html += `
      <div class="tour-modal-backdrop">
        <div class="tour-welcome-modal" style="text-align: center; max-width: 560px;">
          <div style="font-size: 42px; margin-bottom: 12px;">🏆</div>
          <span class="tour-badge" style="background: #ecfdf5; color: #059669;">
            ALL 4 WORKFLOWS VERIFIED
          </span>
          <h2>Outbound Loop Successfully Completed!</h2>
          <p class="tour-intro">
            You’ve experienced the end-to-end Relay CRM loop: Ingestion ➔ Grounded Account Brief ➔
            Human Approval ➔ Inbound Intent Analysis ➔ Warm Handoff Queue.
          </p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 24px; display: grid; gap: 8px; font-size: 13px;">
            <div style="color: #059669; font-weight: 600;">✓ 01 · Lead Ingestion &amp; Sourced Briefs Verified</div>
            <div style="color: #059669; font-weight: 600;">✓ 02 · Human-in-the-Loop Sequence Approval Verified</div>
            <div style="color: #059669; font-weight: 600;">✓ 03 · Inbound Signal Intent Detection Verified</div>
            <div style="color: #059669; font-weight: 600;">✓ 04 · Automated Warm Handoff &amp; Audit Trail Verified</div>
          </div>

          <button class="button primary" id="tour-celebration-close" style="width: 100%; padding: 12px;">
            Close &amp; Explore Workspace ↗
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Event bindings
  document.getElementById("tour-welcome-close")?.addEventListener("click", closeClassicTour);
  document.getElementById("tour-welcome-start")?.addEventListener("click", startTourFromWelcome);
  document.getElementById("tour-dock-min-btn")?.addEventListener("click", () => {
    isTourMinimized = true;
    renderClassicTour();
  });
  document.getElementById("tour-dock-expand")?.addEventListener("click", () => {
    isTourMinimized = false;
    renderClassicTour();
  });
  document.getElementById("tour-dock-close-btn")?.addEventListener("click", closeClassicTour);
  document.getElementById("tour-action-exec-btn")?.addEventListener("click", executeClassicTourAction);
  document.getElementById("tour-nav-prev")?.addEventListener("click", () => goToStep(tourStep - 1));
  document.getElementById("tour-nav-next")?.addEventListener("click", () => {
    if (tourStep < 4) goToStep(tourStep + 1);
    else executeClassicTourAction();
  });
  document.getElementById("tour-celebration-close")?.addEventListener("click", closeClassicTour);
}
