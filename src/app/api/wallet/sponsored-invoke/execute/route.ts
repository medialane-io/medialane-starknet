import { NextRequest } from "next/server";
import { createBackendProxyHandler } from "@medialane/sdk";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

export const runtime = "nodejs";

const handler = createBackendProxyHandler({
  path: "/v1/paymaster/invoke/execute",
  backendUrl: MEDIALANE_BACKEND_URL,
  apiKey: MEDIALANE_API_KEY,
  forwardAuthorization: true,
});

export async function POST(req: NextRequest) {
  return handler(req);
}
