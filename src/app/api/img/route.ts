import { lookup } from "node:dns/promises";
import { createImageProxyHandler, createRateLimiter } from "@medialane/sdk";

export const runtime = "nodejs";

const handler = createImageProxyHandler({
  checkRateLimit: createRateLimiter(60_000, 300),

  resolveHostname: async (hostname) => {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => record.address);
  },
});

export function GET(req: Request) {
  return handler(req);
}
