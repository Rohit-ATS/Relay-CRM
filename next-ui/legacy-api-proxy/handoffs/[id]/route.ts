import { backendRequest } from "../../_backend";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return backendRequest(`/api/handoffs/${encodeURIComponent(id)}`, { method: "PATCH", body: await req.text() });
}
