import { NextResponse } from "next/server";
import { backendRequest } from "../../_backend";

export async function POST(req: Request) {
  const body = await req.json();
  const upstream = await backendRequest("/api/interactions/confirm", { method: "POST", body: JSON.stringify({ account_id: body.accountId, contact_id: body.contactId, channel: "email_reply", content: body.text, confirmed_stage: body.dealStage, task_title: body.nextTask, task_reason: body.reason, notes: "Confirmed in Relay workspace" }) });
  const payload = await upstream.json();
  return NextResponse.json(payload, { status: upstream.status });
}
