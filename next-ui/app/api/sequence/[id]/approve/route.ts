import { backendRequest } from "../../../_backend";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return backendRequest(`/api/sequence/${encodeURIComponent(id)}/approve`, { method: "POST", body: await req.text() });
}
