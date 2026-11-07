import { backendRequest } from "../_backend";
export async function GET() { return backendRequest("/api/accounts"); }
