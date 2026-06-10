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

// ─── Method/path allowlist ────────────────────────────────────────────────
//
// The proxy injects the server-only `MEDIALANE_API_KEY` into every outbound
// request. The key is a fully-privileged tenant key — backend layered auth
// (SIWS JWT, SNIP-12 signatures, on-chain ownership checks) handles the real
// authorisation per route, but defense-in-depth at this boundary limits the
// surface a leaked key or a future backend route addition can reach through
// the dapp BFF.
//
// Scope rationale (mirrors medialane-io's allowlist; audit:
// `medialane-core/docs/audits/2026-05-25-medialane-io-bff-proxy-auth-audit.md`):
//   - GET requests on /v1/* are ALL allowed — reads are public-equivalent
//     and the backend has no admin GET surface on /v1/ (admin lives at
//     /admin/* on a separate API_SECRET_KEY gate). Per-resource GET
//     enumeration is a known footgun — when a new SDK method appears
//     without a matching pattern, otherwise-fine pages 403 in production.
//   - POST/PATCH/DELETE writes are an EXPLICIT enumeration. Any new
//     mutating route used by the dapp requires a corresponding entry
//     and a dapp PR.
//
// When adding a new mutating endpoint to the dapp, add the (method, regex)
// pair below. Match against the path AFTER the `/v1/` prefix.

const ALLOWED_ROUTES: Record<string, RegExp[]> = {
  // ── Reads (all GET /v1/* allowed) ──────────────────────────────────────
  GET: [/.+/],
  // ── Mutations (explicit) ───────────────────────────────────────────────
  POST: [
    /^auth\/siws\/(nonce|verify)$/,                        // dapp SIWS sign-in
    /^collections\/(register|sync-tx|claim)$/,             // launchpad create + on-chain claim
    /^collections\/claim\/request$/,                       // manual-review claim request
    /^coins\/sync$/,                                       // creator coin launch → instant index
    /^collection-slug-claims$/,                            // collection settings slug claim
    /^drop\/conditions$/,                                  // launchpad drop/create
    /^intents\/(mint|create-collection)$/,                 // launchpad mint + create-collection
                                                            // (marketplace intents live on-chain via SDK; not proxied here)
    /^remix-offers(\/(auto|self\/confirm|[^/]+\/(confirm|reject|extend)))?$/,  // remix offer lifecycle
    /^reports$/,                                           // /v1/reports
    /^users\/register$/,                                   // useRegisterUser
    /^username-claims$/,                                   // /v1/username-claims
  ],
  PATCH: [
    /^collections\/[^/]+\/profile$/,                       // updateCollectionProfile
    /^creators\/[^/]+\/profile$/,                          // updateCreatorProfile
  ],
  // DELETE intentionally empty — no dapp flow deletes through the proxy.
};

function isPathAllowed(method: string, path: string): boolean {
  const patterns = ALLOWED_ROUTES[method.toUpperCase()];
  if (!patterns) return false;
  return patterns.some((re) => re.test(path));
}

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
  // anything that appears would be a bug we don't want to surface.
  const outHeaders = new Headers();
  for (const [k, v] of res.headers.entries()) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(key) || key === "set-cookie") continue;
    outHeaders.set(k, v);
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
