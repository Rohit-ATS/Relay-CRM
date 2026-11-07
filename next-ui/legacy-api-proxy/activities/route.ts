import { backendRequest } from "../_backend";
export async function GET(request: Request) { return backendRequest(`/api/activities${new URL(request.url).search}`); }
