import { type NextRequest, NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT;
// Dedicated gateway takes precedence; falls back to Pinata public gateway.
// Set PINATA_DEDICATED_GATEWAY in Vercel/Railway to your Pinata dedicated gateway URL.
const GATEWAY =
  process.env.PINATA_DEDICATED_GATEWAY ||
  "https://gateway.pinata.cloud";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
// Reasonable ceiling for a proxied thumbnail request.
const MAX_WIDTH = 2000;

const ipCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now >= entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

/**
 * GET /api/ipfs/[...cid]
 *
 * Server-side IPFS proxy. Fetches content from Pinata using the server-only
 * PINATA_JWT, then streams it back to the browser. This avoids:
 *  - Pinata's Cross-Origin-Resource-Policy: same-origin header on free plans
 *  - Browser-visible rate limit (429) errors from the public gateway
 *  - The need for a dedicated Pinata gateway on the client
 *
 * Supports paths: /api/ipfs/QmXxx  and  /api/ipfs/QmXxx/image.png
 *
 * Optional `w` query param requests an on-the-fly resized/re-encoded
 * rendition via Pinata's gateway image optimization (`img-width` etc,
 * only documented on the `/files/{cid}` path — not the classic `/ipfs/{cid}`
 * one, and confirmed to 401 on the shared public gateway domain without a
 * gateway-scoped token). Only attempted when `PINATA_DEDICATED_GATEWAY` is
 * actually configured; falls back to the plain unresized `/ipfs/{cid}`
 * original otherwise — never a broken image.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string[] }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { cid: segments } = await params;
  const cidPath = segments.join("/");

  // Validate CID format — CIDv0 (Qm...) or CIDv1 (bafy..., bafk..., etc.)
  // Optional sub-path after the CID (letters, digits, dots, dashes, underscores, slashes)
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[a-z2-7]{58,})(\/[\w.\-/]*)?$/.test(cidPath)) {
    return NextResponse.json({ error: "Invalid IPFS path" }, { status: 400 });
  }

  const isDedicatedGateway = !!process.env.PINATA_DEDICATED_GATEWAY;
  const width = Number.parseInt(req.nextUrl.searchParams.get("w") ?? "", 10);
  const wantsResize = isDedicatedGateway && Number.isFinite(width) && width > 0 && width <= MAX_WIDTH;

  const url = new URL(`${GATEWAY}/${wantsResize ? "files" : "ipfs"}/${cidPath}`);
  if (wantsResize) {
    url.searchParams.set("img-width", String(width));
    url.searchParams.set("img-fit", "cover");
    url.searchParams.set("img-format", "auto");
    url.searchParams.set("img-quality", "80");
  }

  const headers: HeadersInit = {};
  if (PINATA_JWT) {
    headers["Authorization"] = `Bearer ${PINATA_JWT}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { headers, next: { revalidate: 86400 } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch from IPFS" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "IPFS content unavailable" }, { status: upstream.status });
  }

  const upstreamContentType = upstream.headers.get("content-type") ?? "";
  const upstreamContentLength = Number(upstream.headers.get("content-length") ?? 0);
  if (upstreamContentLength > MAX_RESPONSE_BYTES) {
    return NextResponse.json({ error: "IPFS content too large" }, { status: 413 });
  }

  // Allowlist safe MIME type prefixes — reject text/html, text/javascript,
  // image/svg+xml and other scriptable types that could execute in browser context.
  const SAFE_PREFIXES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
    "video/", "audio/", "model/", "font/", "application/json", "application/octet-stream"];
  const safeContentType = SAFE_PREFIXES.some((p) => upstreamContentType.startsWith(p))
    ? upstreamContentType
    : "application/octet-stream";

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_RESPONSE_BYTES) {
    return NextResponse.json({ error: "IPFS content too large" }, { status: 413 });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": safeContentType,
      "X-Content-Type-Options": "nosniff",
      // Cache aggressively — IPFS content is immutable by CID. `s-maxage` (vs
      // browser-only `max-age`) lets Vercel's edge cache this across *all*
      // visitors, not just the requesting browser.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      // Allow any origin to embed this content (images, etc.)
      "Access-Control-Allow-Origin": "*",
    },
  });
}
