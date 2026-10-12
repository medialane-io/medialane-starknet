import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";

type Handler = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;

const realFetch = globalThis.fetch;
let forwarded: Headers | undefined;
let forwardedUrl: string | undefined;
let GET: Handler;
let POST: Handler;

beforeAll(async () => {
  process.env.MEDIALANE_API_KEY = "test-key";
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    forwardedUrl = String(url);
    forwarded = new Headers(init?.headers);
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  ({ GET, POST } = await import("./route"));
});

beforeEach(() => {
  forwarded = undefined;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });

test("the gateway names its app and ignores an app id sent by the browser", async () => {
  const res = await GET(new NextRequest("http://localhost/api/proxy/v1/orders", { headers: { "x-app-id": "MEDIALANE_DAO" } }), params("orders"));
  expect(res.status).toBe(200);
  expect(forwarded?.get("x-app-id")).toBe("MEDIALANE_STARKNET");
  expect(forwarded?.get("x-api-key")).toBe("test-key");
});

test("a signed-in request carries the session, never a bearer header", async () => {
  for (const path of [["rpc"], ["paymaster", "invoke", "build"], ["swap", "quote"], ["users", "register"]]) {
    const req = new NextRequest(`http://localhost/api/proxy/v1/${path.join("/")}`, { method: "POST", body: "{}", headers: { authorization: "Bearer siws_old" } });
    req.cookies.set("ml_account_session", "s1");
    const res = await POST(req, params(...path));
    expect(res.status).toBe(200);
    expect(forwardedUrl).toEndWith(`/v1/${path.join("/")}`);
    expect(forwarded?.get("x-account-session")).toBe("s1");
    expect(forwarded?.has("authorization")).toBe(false);
  }
});

test("public reads are cacheable only for visitors", async () => {
  const visitor = await GET(new NextRequest("http://localhost/api/proxy/v1/collections"), params("collections"));
  expect(visitor.headers.get("cache-control")).toContain("s-maxage");
  const signedIn = new NextRequest("http://localhost/api/proxy/v1/collections");
  signedIn.cookies.set("ml_account_session", "s1");
  expect((await GET(signedIn, params("collections"))).headers.get("cache-control")).toBeNull();
});
