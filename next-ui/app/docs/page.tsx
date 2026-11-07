"use client";

import { useState } from "react";
import Link from "next/link";
import "./docs.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://relay-crm-api.onrender.com";

export default function DocsPage() {
  const [copyDropdownOpen, setCopyDropdownOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState("");
  const [selectedLang, setSelectedLang] = useState<
    "typescript" | "python" | "go" | "php" | "java" | "kotlin" | "csharp" | "ruby" | "rust" | "curl"
  >("typescript");
  const [selectedEndpoint, setSelectedEndpoint] = useState<"sequence" | "import" | "interactions" | "qa">("sequence");
  const [liveTestRunning, setLiveTestRunning] = useState(false);
  const [liveTestResponse, setLiveTestResponse] = useState<string | null>(null);
  const [liveTestStatus, setLiveTestStatus] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(""), 3000);
  };

  const copyMarkdownForLLM = () => {
    const markdown = `# Relay CRM API Reference (Documentation for LLMs)
Relay is an AI-native CRM for founder-led B2B outbound workflows.
Base URL: ${API_BASE}

## Core Architecture & Capabilities
1. CSV Lead Ingestion: Upload raw CSV text or files to create linked Account, Contact, and Deal records.
2. Grounded Account Briefs: AI enriches accounts with strictly tagged facts ('user-provided', 'source-linked', 'inference') — never hallucinations.
3. 3-Step Outreach Sequences: Generates personalized, multi-touch outbound emails held in pending review until approved by a human.
4. Sentiment & Intent Analysis: Evaluates prospect replies or call notes, extracts objections and buying signals, and recommends stage advancement.
5. Warm Sales Handoff: On positive reply, transitions deal to "Demo Scheduled" and generates high-priority CRM handoff tasks.
6. Immutable Audit Trail: Every sequence approval and stage transition logs chronological activities with operator reasons.

## Key Endpoints
- POST /api/import - Parse CSV lead list into linked Account, Contact, and Deal records.
- POST /api/enrich - Generate account brief with source-labeled facts.
- POST /api/sequence - Generate personalized 3-step email sequence.
- POST /api/sequence/{id}/approve - Human approval checkpoint. Transitions deal to Outreach.
- POST /api/interactions - Analyze inbound reply or call note for buying signals.
- POST /api/interactions/confirm - Confirm stage update (Demo Scheduled) and create Warm Handoff task.
- GET /api/qa/verify-import - Wren Workflow A automated verification.
- GET /api/qa/verify-handoff - Wren Workflow B automated verification.
- POST /api/reset?seed=true - One-click demo workspace reset.
`;
    navigator.clipboard.writeText(markdown).then(
      () => showToast("Copied page as Markdown for LLMs!"),
      () => showToast("Could not copy the page. Check clipboard permissions.")
    );
    setCopyDropdownOpen(false);
  };

  const openInProvider = (provider: "chatgpt" | "claude" | "perplexity") => {
    const prompt = encodeURIComponent(
      `Here is the Relay CRM API documentation (${API_BASE}). How do I integrate lead import, sequence generation, and human handoff workflows in my project?`
    );
    let url = "";
    if (provider === "chatgpt") url = `https://chatgpt.com/?q=${prompt}`;
    if (provider === "claude") url = `https://claude.ai/new?q=${prompt}`;
    if (provider === "perplexity") url = `https://www.perplexity.ai/search?q=${prompt}`;
    window.open(url, "_blank");
    setCopyDropdownOpen(false);
  };

  const copyOpenApiUrl = () => {
    navigator.clipboard.writeText(`${API_BASE}/openapi.json`).then(
      () => showToast("OpenAPI URL copied to clipboard!"),
      () => showToast("Could not copy the URL. Check clipboard permissions.")
    );
    setCopyDropdownOpen(false);
  };

  const runLiveTest = async () => {
    setLiveTestRunning(true);
    setLiveTestResponse(null);
    setLiveTestStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/qa/status`);
      const data = await res.json();
      setLiveTestStatus(res.status);
      setLiveTestResponse(JSON.stringify(data, null, 2));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "The request failed.";
      setLiveTestResponse(`Error: ${message}`);
    } finally {
      setLiveTestRunning(false);
    }
  };

  const codeSnippets: Record<string, Record<string, string>> = {
    typescript: {
      sequence: `import { RelayClient } from "@relay-crm/sdk";

const relay = new RelayClient({ baseUrl: "${API_BASE}" });

// Generate 3-step personalized outreach with human review checkpoint
const sequence = await relay.sequences.create({
  accountId: "acc_finscale",
  notes: "Mention Series A round and engineering pain points"
});

console.log("3-Step Sequence Draft:", sequence.steps);
// sequence.status is 'pending_approval' until explicitly approved`,
      import: `import { RelayClient } from "@relay-crm/sdk";

const relay = new RelayClient({ baseUrl: "${API_BASE}" });

const leads = await relay.leads.importCsv({
  csvText: \`name,title,company,email,website,notes
Sarah Chen,VP Engineering,FinScale AI,sarah@finscale.ai,finscale.ai,Scaling Series A outbound\`
});

console.log("Imported Accounts:", leads.imported_accounts);`,
      interactions: `import { RelayClient } from "@relay-crm/sdk";

const relay = new RelayClient({ baseUrl: "${API_BASE}" });

// Analyze inbound prospect reply
const analysis = await relay.interactions.analyze({
  accountId: "acc_finscale",
  content: "Sounds great! Can we schedule a 20-min demo on Thursday at 2pm?",
  applyImmediately: true // Auto-transitions stage to Demo Scheduled + creates handoff
});

console.log("Handoff Created:", analysis.handoff_created);`,
      qa: `// Wren Workflow Verifications
const proofA = await fetch("${API_BASE}/api/qa/verify-import").then(r => r.json());
const proofB = await fetch("${API_BASE}/api/qa/verify-handoff").then(r => r.json());

console.log("Workflow A Passed:", proofA.passed);
console.log("Workflow B Passed:", proofB.passed);`,
    },
    python: {
      sequence: `import httpx

API_BASE = "${API_BASE}"

# Generate 3-step sequence
response = httpx.post(
    f"{API_BASE}/api/sequence",
    json={
        "account_id": "acc_finscale",
        "notes": "Mention Series A round and engineering pain points"
    }
)
sequence = response.json()
print("Draft Status:", sequence["status"])  # 'pending_approval'`,
      import: `import httpx

API_BASE = "${API_BASE}"

csv_content = """name,title,company,email,website,notes
Sarah Chen,VP Engineering,FinScale AI,sarah@finscale.ai,finscale.ai,Scaling Series A outbound"""

response = httpx.post(
    f"{API_BASE}/api/import",
    data={"csv_text": csv_content}
)
print("Import Summary:", response.json())`,
      interactions: `import httpx

API_BASE = "${API_BASE}"

# Analyze inbound reply for buying signals
response = httpx.post(
    f"{API_BASE}/api/interactions",
    json={
        "account_id": "acc_finscale",
        "content": "Sounds great! Can we schedule a 20-min demo on Thursday at 2pm?",
        "apply_immediately": True
    }
)
result = response.json()
print("Proposed Stage:", result["proposed_update"]["proposed_stage"])
print("Handoff Task Created:", result["handoff_created"])`,
      qa: `import httpx

API_BASE = "${API_BASE}"

resp_a = httpx.get(f"{API_BASE}/api/qa/verify-import").json()
resp_b = httpx.get(f"{API_BASE}/api/qa/verify-handoff").json()

print(f"Workflow A Proof: {resp_a['passed']} | {resp_a['summary']}")
print(f"Workflow B Proof: {resp_b['passed']} | {resp_b['summary']}")`,
    },
    go: {
      sequence: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	payload, _ := json.Marshal(map[string]string{
		"account_id": "acc_finscale",
		"notes":      "Mention Series A round",
	})
	resp, err := http.Post("${API_BASE}/api/sequence", "application/json", bytes.NewBuffer(payload))
	if err != nil { panic(err) }
	fmt.Printf("Status: %s\\n", resp.Status)
}`,
      import: `package main

import (
	"fmt"
	"net/http"
	"net/url"
)

func main() {
	csv := "name,title,company,email\\nSarah Chen,VP Eng,FinScale,sarah@finscale.ai"
	resp, _ := http.PostForm("${API_BASE}/api/import", url.Values{"csv_text": {csv}})
	fmt.Printf("Import Response: %s\\n", resp.Status)
}`,
      interactions: `package main

import (
	"bytes"
	"encoding/json"
	"net/http"
)

func main() {
	payload, _ := json.Marshal(map[string]any{
		"account_id": "acc_finscale",
		"content":    "Let's book a demo Thursday at 2pm",
		"apply_immediately": true,
	})
	http.Post("${API_BASE}/api/interactions", "application/json", bytes.NewBuffer(payload))
}`,
      qa: `package main

import (
	"fmt"
	"net/http"
)

func main() {
	resp, _ := http.Get("${API_BASE}/api/qa/status")
	fmt.Printf("QA Health: %s\\n", resp.Status)
}`,
    },
    php: {
      sequence: `<?php
$ch = curl_init('${API_BASE}/api/sequence');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'account_id' => 'acc_finscale',
    'notes' => 'Mention Series A round'
]));
$response = curl_exec($ch);
echo $response;`,
      import: `<?php
$ch = curl_init('${API_BASE}/api/import');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, [
    'csv_text' => "name,title,company,email\nSarah Chen,VP Eng,FinScale,sarah@finscale.ai"
]);
echo curl_exec($ch);`,
      interactions: `<?php
$ch = curl_init('${API_BASE}/api/interactions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'account_id' => 'acc_finscale',
    'content' => 'Schedule demo on Thursday',
    'apply_immediately' => true
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
echo curl_exec($ch);`,
      qa: `<?php
$res = file_get_contents('${API_BASE}/api/qa/verify-import');
print_r(json_decode($res, true));`,
    },
    java: {
      sequence: `import java.net.URI;
import java.net.http.*;

public class RelayApp {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String json = "{\"account_id\":\"acc_finscale\",\"notes\":\"Series A outreach\"}";
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("${API_BASE}/api/sequence"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();
        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        System.out.println(resp.body());
    }
}`,
      import: `HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("${API_BASE}/api/import"))
    .POST(HttpRequest.BodyPublishers.ofString("csv_text=name,email\\nSarah,s@finscale.ai"))
    .build();`,
      interactions: `HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("${API_BASE}/api/interactions"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString("{\"account_id\":\"acc_1\",\"content\":\"Book demo\"}"))
    .build();`,
      qa: `HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("${API_BASE}/api/qa/verify-handoff"))
    .GET().build();`,
    },
    kotlin: {
      sequence: `import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType

val client = OkHttpClient()
val json = """{"account_id": "acc_finscale", "notes": "Series A"}"""
val body = RequestBody.create("application/json".toMediaType(), json)
val request = Request.Builder().url("${API_BASE}/api/sequence").post(body).build()
val response = client.newCall(request).execute()
println(response.body?.string())`,
      import: `val formBody = FormBody.Builder()
    .add("csv_text", "name,email\\nSarah,sarah@finscale.ai").build()
val request = Request.Builder().url("${API_BASE}/api/import").post(formBody).build()`,
      interactions: `val json = """{"account_id":"acc_1","content":"Demo scheduled","apply_immediately":true}"""
val body = RequestBody.create("application/json".toMediaType(), json)
val request = Request.Builder().url("${API_BASE}/api/interactions").post(body).build()`,
      qa: `val request = Request.Builder().url("${API_BASE}/api/qa/status").get().build()
println(client.newCall(request).execute().body?.string())`,
    },
    csharp: {
      sequence: `using System.Net.Http.Json;

using var client = new HttpClient();
var payload = new { account_id = "acc_finscale", notes = "Series A outreach" };
var response = await client.PostAsJsonAsync("${API_BASE}/api/sequence", payload);
var content = await response.Content.ReadAsStringAsync();
Console.WriteLine(content);`,
      import: `var values = new Dictionary<string, string> { { "csv_text", "name,email\\nSarah,s@f.ai" } };
var content = new FormUrlEncodedContent(values);
var response = await client.PostAsync("${API_BASE}/api/import", content);`,
      interactions: `var payload = new { account_id = "acc_finscale", content = "Book demo", apply_immediately = true };
var response = await client.PostAsJsonAsync("${API_BASE}/api/interactions", payload);`,
      qa: `var proof = await client.GetStringAsync("${API_BASE}/api/qa/verify-import");
Console.WriteLine(proof);`,
    },
    ruby: {
      sequence: `require 'net/http'
require 'json'

uri = URI('${API_BASE}/api/sequence')
req = Net::HTTP::Post.new(uri, 'Content-Type' => 'application/json')
req.body = { account_id: 'acc_finscale', notes: 'Series A pain points' }.to_json
res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
puts res.body`,
      import: `res = Net::HTTP.post_form(URI('${API_BASE}/api/import'), 'csv_text' => "name,email\\nSarah,s@f.ai")
puts res.body`,
      interactions: `uri = URI('${API_BASE}/api/interactions')
req = Net::HTTP::Post.new(uri, 'Content-Type' => 'application/json')
req.body = { account_id: 'acc_finscale', content: 'Demo schedule request' }.to_json
res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }`,
      qa: `res = Net::HTTP.get(URI('${API_BASE}/api/qa/verify-handoff'))
puts res`,
    },
    rust: {
      sequence: `use reqwest::Client;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    let res = client.post("${API_BASE}/api/sequence")
        .json(&json!({
            "account_id": "acc_finscale",
            "notes": "Mention Series A round"
        }))
        .send().await?;
    println!("Status: {}", res.status());
    Ok(())
}`,
      import: `let res = client.post("${API_BASE}/api/import")
    .form(&[("csv_text", "name,email\\nSarah,s@finscale.ai")])
    .send().await?;`,
      interactions: `let res = client.post("${API_BASE}/api/interactions")
    .json(&json!({"account_id": "acc_finscale", "content": "Schedule demo"}))
    .send().await?;`,
      qa: `let res = client.get("${API_BASE}/api/qa/verify-import").send().await?;
println!("Workflow A: {}", res.text().await?);`,
    },
    curl: {
      sequence: `curl -X POST "${API_BASE}/api/sequence" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": "acc_finscale",
    "notes": "Mention Series A round and engineering pain points"
  }'`,
      import: `curl -X POST "${API_BASE}/api/import" \\
  -F "csv_text=name,title,company,email,website,notes
Sarah Chen,VP Engineering,FinScale AI,sarah@finscale.ai,finscale.ai,Scaling Series A outbound"`,
      interactions: `curl -X POST "${API_BASE}/api/interactions" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": "acc_finscale",
    "content": "Sounds great! Can we schedule a 20-min demo on Thursday at 2pm?",
    "apply_immediately": true
  }'`,
      qa: `curl "${API_BASE}/api/qa/verify-import"
curl "${API_BASE}/api/qa/verify-handoff"`,
    },
  };

  return (
    <div className="docs-shell">
      {copiedToast && <div className="docs-toast">{copiedToast}</div>}

      {/* Top Navigation Bar - Dodo Payments layout */}
      <header className="docs-topbar">
        <div className="docs-brand">
          <Link href="/" className="docs-logo">
            <span className="docs-logo-mark">✳</span>
            <span className="docs-logo-text">relay<span className="docs-dot">.</span></span>
          </Link>
          <span className="docs-badge">Documentation</span>
          <span className="docs-live-pill">
            <i className="docs-pulse-dot" /> Live on Render
          </span>
        </div>

        {/* Screenshot 2 Top Tabs */}
        <nav className="docs-nav-tabs">
          <Link href="/docs" className="docs-nav-tab active">
            Docs
          </Link>
          <a href="#handles" className="docs-nav-tab">
            Guides
          </a>
          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="docs-nav-tab">
            API Reference ↗
          </a>
          <a href="#sdks" className="docs-nav-tab">
            External Integrations
          </a>
          <a href={`${API_BASE}/api/qa/status`} target="_blank" rel="noreferrer" className="docs-nav-tab">
            Changelog &amp; Proof ↗
          </a>
          <Link href="/workspace" className="docs-nav-tab">
            Community &amp; CRM App
          </Link>
        </nav>

        <div className="docs-top-actions">
          <div className="docs-search-fake">
            <span>⌕</span>
            <input type="text" placeholder="Search API docs..." readOnly />
            <kbd>⌘K</kbd>
          </div>

          {/* Screenshot 1: Copy Page Dropdown Widget */}
          <div className="copy-widget-wrapper">
            <button
              className="copy-page-btn"
              onClick={() => setCopyDropdownOpen(!copyDropdownOpen)}
              aria-label="Copy page options"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy page</span>
              <span className="dropdown-caret">{copyDropdownOpen ? "⌃" : "⌄"}</span>
            </button>

            {copyDropdownOpen && (
              <div className="copy-dropdown-menu">
                <button className="dropdown-item" onClick={copyMarkdownForLLM}>
                  <div className="dropdown-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </div>
                  <div>
                    <b>Copy page</b>
                    <small>Copy page as Markdown for LLMs</small>
                  </div>
                </button>

                <a
                  className="dropdown-item"
                  href={`${API_BASE}/openapi.json`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setCopyDropdownOpen(false)}
                >
                  <div className="dropdown-icon">
                    <span style={{ fontWeight: 800, fontSize: "11px" }}>M↓</span>
                  </div>
                  <div>
                    <b>View as Markdown ↗</b>
                    <small>View this page as plain text / OpenAPI</small>
                  </div>
                </a>

                <button className="dropdown-item" onClick={() => openInProvider("chatgpt")}>
                  <div className="dropdown-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729z" />
                    </svg>
                  </div>
                  <div>
                    <b>Open in ChatGPT ↗</b>
                    <small>Ask questions about this page</small>
                  </div>
                </button>

                <button className="dropdown-item" onClick={() => openInProvider("claude")}>
                  <div className="dropdown-icon">
                    <span style={{ fontSize: "18px", color: "#d97706" }}>✳</span>
                  </div>
                  <div>
                    <b>Open in Claude ↗</b>
                    <small>Ask questions about this page</small>
                  </div>
                </button>

                <button className="dropdown-item" onClick={() => openInProvider("perplexity")}>
                  <div className="dropdown-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                  <div>
                    <b>Open in Perplexity ↗</b>
                    <small>Ask questions about this page</small>
                  </div>
                </button>

                <button className="dropdown-item" onClick={copyOpenApiUrl}>
                  <div className="dropdown-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <b>Copy OpenAPI URL</b>
                    <small>Use the schema with your API tooling</small>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="docs-container">
        {/* Hero Introduction */}
        <section className="docs-hero">
          <div className="docs-eyebrow">INTRODUCTION</div>
          <h1>Welcome to Relay CRM</h1>
          <p className="docs-subhead">
            Relay CRM is the AI-native customer relationship platform built for founder-led sales teams.
            Turn raw prospect spreadsheets into structured accounts, generate grounded multi-step outreach,
            and keep deal stages synchronised as replies arrive — with human verification safeguarding every promise.
          </p>
        </section>

        {/* Screenshot 2: Top 3 Cards */}
        <section className="docs-top-cards">
          <div className="top-card">
            <div className="top-card-icon">
              {/* Green Robot Icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            </div>
            <h3>Integrate with Your Coding Agent</h3>
            <p>
              Install the Agent Plugin or MCP Server and have your coding agent build the integration, query accounts, and automate workflows.
            </p>
          </div>

          <div className="top-card">
            <div className="top-card-icon">
              {/* Green Code Bracket Icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <h3>Start Integrating</h3>
            <p>
              Upload lead lists via CSV, generate tailored 3-step sequences, handle inbound replies, and schedule warm rep handoffs.
            </p>
          </div>

          <div className="top-card">
            <div className="top-card-icon">
              {/* Green Balance Scales Icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 16l3-8 3 8a3 3 0 0 1-6 0z" />
                <path d="M2 16l3-8 3 8a3 3 0 0 1-6 0z" />
                <path d="M7 21h10" />
                <path d="M12 3v18" />
                <path d="M3 7h18" />
              </svg>
            </div>
            <h3>How Human-in-the-Loop Works</h3>
            <p>
              What Relay CRM automates as an AI copilot, and what requires human review before executing external communications.
            </p>
          </div>
        </section>

        {/* Screenshot 2: What Relay CRM Handles (2x2 Grid) */}
        <section className="docs-handles-section" id="handles">
          <h2>What Relay CRM Handles</h2>
          <div className="handles-grid">
            <div className="handle-card">
              <div className="handle-icon">
                {/* Green Globe Icon */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h4>Zero-Upkeep Records</h4>
              <p>
                Relay parses raw CSV leads and inbound conversation notes, keeping linked Account, Contact,
                and Deal stages up to date without manual CRM data entry.
              </p>
            </div>

            <div className="handle-card">
              <div className="handle-icon">
                {/* Green Card / Terminal Icon */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <h4>Autonomous 3-Step Sequences</h4>
              <p>
                Multi-channel touchpoints tailored to prospect pain points, saved in pending review so founders
                never dispatch unvetted outreach.
              </p>
            </div>

            <div className="handle-card">
              <div className="handle-icon">
                {/* Green Coins Stack Icon */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
              <h4>Sourced Intelligence &amp; Labeled Facts</h4>
              <p>
                Account briefs strictly tag each fact as <code>user-provided</code>, <code>source-linked</code>,
                or <code>inference</code> — completely eliminating unverified AI hallucinations.
              </p>
            </div>

            <div className="handle-card">
              <div className="handle-icon">
                {/* Green Circular Sync / Refresh Icon */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </div>
              <h4>Automated Warm Handoffs</h4>
              <p>
                When a prospect expresses interest or requests a demo, Relay advances the deal to Demo Scheduled
                and generates high-priority sales tasks with context notes.
              </p>
            </div>
          </div>
        </section>

        {/* Request examples for popular server languages */}
        <section className="docs-sdks-section" id="sdks">
          <h2>Request examples</h2>
          <p className="sdk-subhead">
            Relay is a standard HTTP API, so there is no SDK to install. Pick a language to see a ready-to-adapt request.
          </p>

          <div className="sdk-grid">
            {/* Card 1: TypeScript */}
            <div
              className={`sdk-card ${selectedLang === "typescript" ? "active" : ""}`}
              onClick={() => setSelectedLang("typescript")}
            >
              <div className="sdk-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="8 7 3 12 8 17" />
                  <polyline points="16 7 21 12 16 17" />
                </svg>
              </div>
              <b>TypeScript</b>
              {selectedLang === "typescript" && <span className="sdk-active-badge">Selected</span>}
            </div>

            {/* Card 2: Python */}
            <div
              className={`sdk-card ${selectedLang === "python" ? "active" : ""}`}
              onClick={() => setSelectedLang("python")}
            >
              <div className="sdk-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#587428">
                  <path d="M11.9 2c-3.1 0-5.2.4-5.2 2.6v2.1h5.3v.8H4.6C2.5 7.5 1 9.4 1 12.5s1.3 5 3.6 5h1.9v-2.5c0-1.8 1.5-3.3 3.3-3.3h5.1c1.5 0 2.7-1.2 2.7-2.7V4.7c0-2.3-2.6-2.7-5.7-2.7zm-2.8 1.6c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm2.9 18.4c3.1 0 5.2-.4 5.2-2.6v-2.1h-5.3v-.8h7.4c2.1 0 3.6-1.9 3.6-5s-1.3-5-3.6-5h-1.9v2.5c0 1.8-1.5 3.3-3.3 3.3H9c-1.5 0-2.7 1.2-2.7 2.7v4.3c0 2.3 2.6 2.7 5.7 2.7zm2.8-1.6c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z" />
                </svg>
              </div>
              <b>Python</b>
              {selectedLang === "python" && <span className="sdk-active-badge">Selected</span>}
            </div>

            {/* Card 3: Go */}
            <div
              className={`sdk-card ${selectedLang === "go" ? "active" : ""}`}
              onClick={() => setSelectedLang("go")}
            >
              <div className="sdk-icon">
                <svg width="30" height="22" viewBox="0 0 40 20" fill="#587428">
                  <path d="M4 10c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8-8-3.6-8-8zm5 0c0 2.8 1.3 4 3 4s3-1.2 3-4-1.3-4-3-4-3 1.2-3 4z" />
                  <path d="M22 6h4v1.8h-4zm0 3.6h4V18h-4zm7-3.6h4v1.8h-4zm0 3.6h4V18h-4z" />
                </svg>
              </div>
              <b>Go</b>
              {selectedLang === "go" && <span className="sdk-active-badge">Selected</span>}
            </div>

            {/* Card 4: PHP */}
            <div
              className={`sdk-card ${selectedLang === "php" ? "active" : ""}`}
              onClick={() => setSelectedLang("php")}
            >
              <div className="sdk-icon">
                <svg width="28" height="22" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="12" rx="10" ry="6" />
                  <path d="M8 10v4M8 12h2a1 1 0 0 0 1-1v0a1 1 0 0 0-1-1H8z" />
                  <path d="M14 10v4M14 12h2a1 1 0 0 0 1-1v0a1 1 0 0 0-1-1h-2z" />
                </svg>
              </div>
              <b>PHP</b>
              {selectedLang === "php" && <span className="sdk-active-badge">Selected</span>}
            </div>

            {/* Card 5: Java */}
            <div
              className={`sdk-card ${selectedLang === "java" ? "active" : ""}`}
              onClick={() => setSelectedLang("java")}
            >
              <div className="sdk-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                  <line x1="6" y1="1" x2="6" y2="4" />
                  <line x1="10" y1="1" x2="10" y2="4" />
                  <line x1="14" y1="1" x2="14" y2="4" />
                </svg>
              </div>
              <b>Java</b>
              {selectedLang === "java" && <span className="sdk-active-badge">Selected</span>}
            </div>

            {/* Card 6: Kotlin */}
            <div
              className={`sdk-card ${selectedLang === "kotlin" ? "active" : ""}`}
              onClick={() => setSelectedLang("kotlin")}
            >
              <div className="sdk-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 16h14a2 2 0 0 0 2-2V9a7 7 0 0 0-14 0v5a2 2 0 0 0 2 2z" />
                  <line x1="8" y1="3" x2="9" y2="5" />
                  <line x1="16" y1="3" x2="15" y2="5" />
                  <circle cx="9" cy="10" r="1" fill="#587428" />
                  <circle cx="15" cy="10" r="1" fill="#587428" />
                </svg>
              </div>
              <b>Kotlin</b>
              {selectedLang === "kotlin" && <span className="sdk-active-badge">Selected</span>}
            </div>

            {/* Card 7: C# */}
            <div
              className={`sdk-card ${selectedLang === "csharp" ? "active" : ""}`}
              onClick={() => setSelectedLang("csharp")}
            >
              <div className="sdk-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="9" x2="20" y2="9" />
                  <line x1="4" y1="15" x2="20" y2="15" />
                  <line x1="10" y1="3" x2="8" y2="21" />
                  <line x1="16" y1="3" x2="14" y2="21" />
                </svg>
              </div>
              <b>C#</b>
              {selectedLang === "csharp" && <span className="sdk-active-badge">Selected</span>}
            </div>

            {/* Card 8: Ruby */}
            <div
              className={`sdk-card ${selectedLang === "ruby" ? "active" : ""}`}
              onClick={() => setSelectedLang("ruby")}
            >
              <div className="sdk-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="6 3 18 3 22 9 12 22 2 9" />
                  <polyline points="2 9 12 13 22 9" />
                  <polyline points="12 13 12 22" />
                  <polyline points="6 3 12 13 18 3" />
                </svg>
              </div>
              <b>Ruby</b>
              {selectedLang === "ruby" && <span className="sdk-active-badge">Selected</span>}
            </div>

            {/* Card 9: Rust */}
            <div
              className={`sdk-card ${selectedLang === "rust" ? "active" : ""}`}
              onClick={() => setSelectedLang("rust")}
            >
              <div className="sdk-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#587428" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              </div>
              <b>Rust</b>
              {selectedLang === "rust" && <span className="sdk-active-badge">Selected</span>}
            </div>
          </div>

          {/* Interactive Code Viewer for Selected Language */}
          <div className="code-viewer-panel">
            <div className="code-viewer-header">
              <div className="endpoint-selector">
                <button
                  className={`endpoint-btn ${selectedEndpoint === "sequence" ? "active" : ""}`}
                  onClick={() => setSelectedEndpoint("sequence")}
                >
                  POST /api/sequence
                </button>
                <button
                  className={`endpoint-btn ${selectedEndpoint === "import" ? "active" : ""}`}
                  onClick={() => setSelectedEndpoint("import")}
                >
                  POST /api/import
                </button>
                <button
                  className={`endpoint-btn ${selectedEndpoint === "interactions" ? "active" : ""}`}
                  onClick={() => setSelectedEndpoint("interactions")}
                >
                  POST /api/interactions
                </button>
                <button
                  className={`endpoint-btn ${selectedEndpoint === "qa" ? "active" : ""}`}
                  onClick={() => setSelectedEndpoint("qa")}
                >
                  GET /api/qa/verify-*
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  className={`endpoint-btn ${selectedLang === "curl" ? "active" : ""}`}
                  onClick={() => setSelectedLang("curl")}
                  style={{ color: "#38bdf8" }}
                >
                  cURL
                </button>
                <button
                  className="copy-code-btn"
                  onClick={() => {
                    const code = codeSnippets[selectedLang]?.[selectedEndpoint] || "";
                    navigator.clipboard.writeText(code).then(
                      () => showToast("Code copied to clipboard!"),
                      () => showToast("Could not copy the snippet. Check clipboard permissions.")
                    );
                  }}
                >
                  Copy Snippet
                </button>
              </div>
            </div>

            <pre className="code-block">
              <code>{codeSnippets[selectedLang]?.[selectedEndpoint] || codeSnippets["curl"][selectedEndpoint]}</code>
            </pre>
          </div>
        </section>

        {/* Live Playground against deployed Render instance */}
        <section className="docs-playground-section">
          <div className="playground-header">
            <div>
              <div className="docs-eyebrow">LIVE PLAYGROUND</div>
              <h2>Test Live Cluster on Render</h2>
              <p>Send an immediate real-time request to the deployed Render backend API.</p>
            </div>
            <button
              className="run-test-btn"
              disabled={liveTestRunning}
              onClick={runLiveTest}
            >
              {liveTestRunning ? "Executing against Render..." : "▶ Run Live Test on Render"}
            </button>
          </div>

          <div className="playground-terminal">
            <div className="terminal-header">
              <div className="terminal-dots"><i /><i /><i /></div>
              <span>GET {API_BASE}/api/qa/status</span>
              <span className={liveTestStatus === 200 ? "status-200" : "status-live"}>
                {liveTestStatus ? `${liveTestStatus} ${liveTestStatus === 200 ? "OK" : "ERROR"}` : "READY"}
              </span>
            </div>
            <pre className="terminal-body">
              {liveTestResponse || `{
  "status": "ready",
  "service": "Relay CRM Core API",
  "accounts_count": 3,
  "deals_count": 3,
  "handoffs_count": 1,
  "activities_count": 10,
  "cluster": "Render Web Service",
  "environment": "production",
  "message": "Click 'Run Live Test on Render' to trigger a live call"
}`}
            </pre>
          </div>
        </section>

        {/* Footer */}
        <footer className="docs-footer">
          <div>
            <b>Relay CRM API</b> · Built for Ship Happens Hackathon
          </div>
          <div className="docs-footer-links">
            <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">Swagger UI</a>
            <a href={`${API_BASE}/redoc`} target="_blank" rel="noreferrer">ReDoc</a>
            <a href={`${API_BASE}/api/qa/verify-import`} target="_blank" rel="noreferrer">Workflow A Proof</a>
            <a href={`${API_BASE}/api/qa/verify-handoff`} target="_blank" rel="noreferrer">Workflow B Proof</a>
            <Link href="/workspace">Open CRM App</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
