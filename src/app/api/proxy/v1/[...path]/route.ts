/**
 * BFF proxy for /v1/* — adds the server-only `MEDIALANE_API_KEY` header
 * and forwards to the Medialane backend. Replaces the previous pattern
 * where client code shipped the API key in the browser bundle via
 * `NEXT_PUBLIC_MEDIALANE_API_KEY`.
 *
 * The SDK client (`src/lib/medialane-client.ts`) targets `/api/proxy`
 * when running in the browser, so SWR hooks like `useCollections`,
 * `useToken`, etc. flow through here automatically. Direct client
 * fetches (launchpad pages, `use-remix-offers`) should also hit
 * `/api/proxy/v1/...` instead of the backend origin.
 *
 * The user's Authorization header (SIWS JWT, if present) is passed
 * through unchanged — the backend still uses it for identity-aware
 * routes (`/v1/users/me`, `/v1/creators/:wallet/profile`, …).
 */
import { type NextRequest, NextResponse } from "next/server";
import { hasTraversalSegment, isPathAllowed } from "./allowlist";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL ?? "http://localhost:3001";

// Hop-by-hop headers per RFC 7230 + a few Next.js / Vercel ones that must
// not be forwarded blindly between caller ↔ proxy ↔ origin.
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "accept-encoding",
]);

// Method/path allowlist — see `./allowlist.ts` (split out from this route
// handler because a route.ts file may only export recognized HTTP-method
// handlers, and the allowlist logic needed to be independently unit-tested).

// ─── Edge caching for anonymous public reads ─────────────────────────────
//
// Public catalog reads (collections/tokens/orders/coins/activities and the
// rewards config/leaderboard) are identical for every anonymous visitor —
// let Vercel's edge cache absorb repeat traffic instead of hitting the
// metered backend per user. Strictly anonymous GET only: any request
// carrying an Authorization header (SIWS identity) is never cached, and
// user-scoped paths are simply not listed here.
const CACHEABLE_GET_PATHS = [
  /^collections(\/|$)/,
  /^tokens(\/|$)/,
  /^orders(\/|$)/,
  /^coins(\/|$)/,
  /^activities(\/|$)/,
  /^rewards\/(config|leaderboard)$/,
  /^search(\/|$)/,
];
const EDGE_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const apiKey = process.env.MEDIALANE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "MEDIALANE_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const { path } = await ctx.params;
  const joinedPath = path.join("/");

  if (hasTraversalSegment(joinedPath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!isPathAllowed(req.method, joinedPath)) {
    // Log enough to debug a legitimate route that needs adding to the
    // allowlist — but don't leak the API key path to the response.
    console.warn("[/api/proxy] blocked by allowlist", {
      method: req.method,
      path: joinedPath,
    });
    return NextResponse.json(
      { error: `Path not allowed through dapp proxy: ${req.method} /v1/${joinedPath}` },
      { status: 403 },
    );
  }

  const target = `${BACKEND_URL.replace(/\/$/, "")}/v1/${joinedPath}${req.nextUrl.search}`;

  // Forward request headers except hop-by-hop + x-api-key (we set our own).
  const fwdHeaders = new Headers();
  for (const [k, v] of req.headers.entries()) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(key) || key === "x-api-key") continue;
    fwdHeaders.set(k, v);
  }
  fwdHeaders.set("x-api-key", apiKey);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const res = await fetch(target, {
    method: req.method,
    headers: fwdHeaders,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  // Forward response headers except hop-by-hop. Keep content-type, cache-
  // control, etc. Strip set-cookie — the backend never sets one for us;
  // anything that appears would be a bug we don't want to surface. Also
  // strip content-encoding: fetch() transparently decompresses a gzip/br
  // body but leaves the original header in place, so forwarding it here
  // labels an already-decoded body as still-encoded — the browser then
  // fails to gunzip it a second time (ERR_CONTENT_DECODING_FAILED).
  const outHeaders = new Headers();
  for (const [k, v] of res.headers.entries()) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(key) || key === "set-cookie" || key === "content-encoding") continue;
    outHeaders.set(k, v);
  }

  if (
    req.method === "GET" &&
    res.ok &&
    !req.headers.get("authorization") &&
    CACHEABLE_GET_PATHS.some((re) => re.test(joinedPath))
  ) {
    outHeaders.set("cache-control", EDGE_CACHE_CONTROL);
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
