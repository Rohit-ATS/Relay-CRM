import { NextResponse } from "next/server";

const backendUrl = process.env.RELAY_BACKEND_URL || "http://127.0.0.1:8000";

export async function backendRequest(path: string, init?: RequestInit): Promise<NextResponse> {
  try {
    const response = await fetch(`${backendUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
    const body = await response.text();
    return new NextResponse(body, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ error: "Relay backend is unavailable. Start FastAPI on port 8000." }, { status: 503 });
  }
}
