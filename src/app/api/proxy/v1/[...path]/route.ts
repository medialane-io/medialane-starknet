
import { type NextRequest, NextResponse } from "next/server";
import { createRateLimiter, isSameOrigin } from "@medialane/sdk";
import { TRUSTED_APP_IP_HEADER, isSpoofableForwardingHeader, trustedClientIp } from "@/lib/client-ip";
import { hasTraversalSegment, isPathAllowed } from "./allowlist";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL ?? "http://localhost:3001";

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

// Every proxied request injects the first-party MEDIALANE_API_KEY (metered
// credits), so this must not be an open proxy. Three guards bound credit-drain
// abuse: the per-method path allowlist in ./allowlist.ts, the same-origin
// check, and the per-IP rate limit. The rate limit is the only one that holds
// against a non-browser client — isSameOrigin passes a request with no Origin
// header at all.
const checkRateLimit = createRateLimiter(60_000, 600);

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed" },
      { status: 403 },
    );
  }

  const callerIp = trustedClientIp(req);
  if (!checkRateLimit(callerIp)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

    console.warn("[/api/proxy] blocked by allowlist", {
      method: req.method,
      path: joinedPath,
    });
    return NextResponse.json(
      { error: `Path not allowed through dapp proxy: ${req.method} /v1/${joinedPath}` },
      { status: 403 },
    );
  }

  const safePath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const target = `${BACKEND_URL.replace(/\/$/, "")}/v1/${safePath}${req.nextUrl.search}`;

  const fwdHeaders = new Headers();
  for (const [k, v] of req.headers.entries()) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(key) || key === "x-api-key") continue;
    if (isSpoofableForwardingHeader(key)) continue;
    fwdHeaders.set(k, v);
  }
  fwdHeaders.set("x-api-key", apiKey);
  fwdHeaders.set(TRUSTED_APP_IP_HEADER, callerIp);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const res = await fetch(target, {
    method: req.method,
    headers: fwdHeaders,
    body,
    cache: "no-store",
    redirect: "manual",
  });

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
