import { NextResponse } from "next/server";
import { ImportRowSchema } from "@/lib/schemas";
import { backendRequest } from "../_backend";

export async function GET() {
  return backendRequest("/api/import/sample");
}

export async function POST(req: Request) {
  const body = await req.json();
  const commit = body && !Array.isArray(body) && body.commit === true;
  if (commit && typeof body.csv_text === "string") return backendRequest("/api/import", { method: "POST", body: JSON.stringify({ csv_text: body.csv_text }) });
  if (body && !Array.isArray(body) && typeof body.csv_text === "string") {
    const upstream = await backendRequest("/api/import/preview", { method: "POST", body: JSON.stringify({ csv_text: body.csv_text }) });
    const payload = await upstream.json();
    if (!upstream.ok) return NextResponse.json(payload, { status: upstream.status });
    return NextResponse.json({ validCount: payload.valid_rows, errors: (payload.errors ?? []).map((message: string, index: number) => ({ row: index + 2, message })), rows: payload.preview ?? [] });
  }
  if (!Array.isArray(body) || body.length > 250) return NextResponse.json({ error: "Upload a CSV with up to 250 leads." }, { status: 400 });
  const valid = body.map((row, index) => ({ row: index + 1, result: ImportRowSchema.safeParse(row) }));
  const errors = valid.filter((item) => !item.result.success).map((item) => ({ row: item.row, message: "Check name, company, and email." }));
  return NextResponse.json({ validCount: valid.length - errors.length, errors, rows: valid.filter((item) => item.result.success).map((item) => (item.result as { success: true; data: unknown }).data) });
}
