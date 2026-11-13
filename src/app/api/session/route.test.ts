import { afterAll, beforeAll, expect, test } from "bun:test";
import { NextRequest } from "next/server";

const realFetch = globalThis.fetch;
let backend: () => Response = () => Response.json(null);
let GET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  process.env.MEDIALANE_API_KEY = "test-key";
  process.env.MEDIALANE_APP_SECRET = "test-secret";
  globalThis.fetch = (async () => backend()) as typeof fetch;
  ({ GET } = await import("./route"));
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

const withCookie = () => {
  const req = new NextRequest("http://localhost/api/session");
  req.cookies.set("ml_account_session", "acct-123");
  return req;
};

test("a session without an email is still signed in", async () => {
  const session = { accountId: "acc_1", publicId: "p1", walletAddress: "0x1", email: null, emailDeadline: null };
  backend = () => Response.json(session);
  const res = await GET(withCookie());
  expect(await res.json()).toEqual(session);
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("a refusal that is not about the session keeps the cookie", async () => {
  backend = () => Response.json({ error: "Invalid or revoked API key" }, { status: 401 });
  const res = await GET(withCookie());
  expect(res.status).toBe(502);
  expect(res.headers.get("set-cookie")).toBeNull();
});
