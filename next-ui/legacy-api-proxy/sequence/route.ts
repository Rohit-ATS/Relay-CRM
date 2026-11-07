import { NextResponse } from "next/server";
import { backendRequest } from "../_backend";

export async function POST(req: Request) {
  const body = await req.json();
  const upstream = await backendRequest("/api/sequence", { method: "POST", body: JSON.stringify({ account_id: body.accountId, accountId: body.accountId, contact_id: body.contactId, contactId: body.contactId, account: body.account, contact: body.account?.contact, notes: body.account?.sourceNotes ?? body.account?.summary }) });
  const payload = await upstream.json();
  if (!upstream.ok) return NextResponse.json(payload, { status: upstream.status });
  const sequence = { id: payload.id, accountId: payload.accountId ?? payload.account_id, status: payload.status === "approved" ? "approved" : "draft", rationale: payload.rationale ?? "Generated from supplied account context.", steps: (payload.steps ?? []).map((step: any) => ({ delay: step.delayDays ?? step.delay_days ?? 0, subject: step.subject, body: step.body, rationale: step.rationale ?? "Generated from supplied account context." })) };
  return NextResponse.json({ sequence, mode: payload.mode, label: payload.mode === "demo_fixture" ? "Demo plan · based on supplied account context" : "AI draft · based on supplied account context" });
}
