import { PrivyClient } from "@privy-io/node";

let _client: PrivyClient | null = null;

/**
 * Lazy singleton — instantiating at module scope makes `next build` fail in
 * any environment without Privy env vars (page-data collection imports the
 * route module). Resolve env at first call instead.
 */
export function getPrivyServer(): PrivyClient {
  if (_client) return _client;
  _client = new PrivyClient({
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
  });
  return _client;
}
