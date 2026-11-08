// API client connecting the frontend to the Relay CRM backend (FastAPI / Render)

import type {
  Account,
  Contact,
  Deal,
  Sequence,
  HandoffTask,
  Activity
} from "../shared/contracts";

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_BASE_URL}/api/accounts`);
  if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.statusText}`);
  return res.json();
}

export async function fetchAccountDetail(id: string): Promise<Account & {
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
  sequences: Sequence[];
  handoffs: HandoffTask[];
}> {
  const res = await fetch(`${API_BASE_URL}/api/accounts/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch account detail: ${res.statusText}`);
  return res.json();
}

export async function importCsvBackend(csvText: string): Promise<{
  imported_accounts: number;
  imported_contacts: number;
  imported_deals: number;
  account_ids: string[];
}> {
  const formData = new FormData();
  formData.append("csv_text", csvText);
  const res = await fetch(`${API_BASE_URL}/api/import`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Import failed: ${res.statusText}`);
  return res.json();
}

export async function generateBrief(accountId: string) {
  const res = await fetch(`${API_BASE_URL}/api/enrich`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId }),
  });
  if (!res.ok) throw new Error(`Failed to generate brief: ${res.statusText}`);
  return res.json();
}

export async function generateSequence(accountId: string, contactId?: string) {
  const res = await fetch(`${API_BASE_URL}/api/sequence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId, contact_id: contactId }),
  });
  if (!res.ok) throw new Error(`Failed to generate sequence: ${res.statusText}`);
  return res.json();
}

export async function approveSequence(sequenceId: string, notes?: string) {
  const res = await fetch(`${API_BASE_URL}/api/sequence/${sequenceId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(`Failed to approve sequence: ${res.statusText}`);
  return res.json();
}

export async function analyzeInteraction(accountId: string, content: string, channel = "email_reply") {
  const res = await fetch(`${API_BASE_URL}/api/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: accountId,
      channel,
      content,
      apply_immediately: false,
    }),
  });
  if (!res.ok) throw new Error(`Failed to analyze interaction: ${res.statusText}`);
  return res.json();
}

export async function confirmInteraction(
  accountId: string,
  content: string,
  confirmedStage: string,
  taskTitle: string,
  taskReason: string,
  channel = "email_reply"
) {
  const res = await fetch(`${API_BASE_URL}/api/interactions/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: accountId,
      channel,
      content,
      confirmed_stage: confirmedStage,
      task_title: taskTitle,
      task_reason: taskReason,
    }),
  });
  if (!res.ok) throw new Error(`Failed to confirm interaction: ${res.statusText}`);
  return res.json();
}

export async function fetchHandoffs(status = "pending"): Promise<HandoffTask[]> {
  const res = await fetch(`${API_BASE_URL}/api/handoffs?status=${status}`);
  if (!res.ok) throw new Error(`Failed to fetch handoffs: ${res.statusText}`);
  return res.json();
}

export async function completeHandoff(taskId: string): Promise<HandoffTask> {
  const res = await fetch(`${API_BASE_URL}/api/handoffs/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" }),
  });
  if (!res.ok) throw new Error(`Failed to update handoff: ${res.statusText}`);
  return res.json();
}

export async function resetBackendDemo(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/reset?seed=true`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Reset failed: ${res.statusText}`);
  return res.json();
}
