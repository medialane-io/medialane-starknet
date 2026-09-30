import { lookup } from "node:dns/promises";
import { createImageProxyHandler } from "@medialane/sdk";

export const runtime = "nodejs";

const handler = createImageProxyHandler({

  resolveHostname: async (hostname) => {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => record.address);
  },
});

export function GET(req: Request) {
  return handler(req);
}
