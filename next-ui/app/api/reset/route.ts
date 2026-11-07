import { backendRequest } from "../_backend";

export async function POST() {
  return backendRequest("/api/reset?seed=true", { method: "POST" });
}
