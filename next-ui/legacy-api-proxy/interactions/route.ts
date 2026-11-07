import { NextResponse } from "next/server";
import { backendRequest } from "../_backend";

export async function POST(req: Request) {
  const body = await req.json();
  const upstream = await backendRequest("/api/interactions", { method: "POST", body: JSON.stringify({ account_id: body.accountId, content: body.text, channel: "email_reply", apply_immediately: false }) });
  const payload = await upstream.json();
  if (!upstream.ok) return NextResponse.json(payload, { status: upstream.status });
  const update = payload.proposed_update ?? {};
  return NextResponse.json({ mode: "backend", proposal: { positive: ["request_demo", "warm_followup", "question"].includes(payload.intent), contactStatus: "replied", dealStage: update.proposed_stage, reason: update.recommended_task_reason ?? update.reasoning, nextTask: update.recommended_task_title, summary: update.reasoning ?? `Interaction analyzed as ${payload.intent}.`, evidence: update.evidence_quote, accountId: body.accountId } });
}
