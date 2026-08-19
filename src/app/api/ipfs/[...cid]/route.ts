import { type NextRequest, NextResponse } from "next/server";
import {
  isValidIpfsCidPath,
  resolveSafeImageContentType,
  MAX_IPFS_GATEWAY_RESPONSE_BYTES,
} from "@medialane/sdk";
import { createRateLimiter } from "@/lib/rate-limit";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

const checkRateLimit = createRateLimiter(60_000, 120);

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

  if (!isValidIpfsCidPath(cidPath)) {
    return NextResponse.json({ error: "Invalid IPFS path" }, { status: 400 });
  }

  const url = `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/metadata/image/${cidPath}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { "x-api-key": MEDIALANE_API_KEY },
      signal: AbortSignal.timeout(18_000),
      next: { revalidate: 86400 },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch from IPFS" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "IPFS content unavailable" }, { status: upstream.status });
  }

  const upstreamContentType = upstream.headers.get("content-type") ?? "";
  const upstreamContentLength = Number(upstream.headers.get("content-length") ?? 0);
  if (upstreamContentLength > MAX_IPFS_GATEWAY_RESPONSE_BYTES) {
    return NextResponse.json({ error: "IPFS content too large" }, { status: 413 });
  }

  const safeContentType = resolveSafeImageContentType(upstreamContentType);

  if (!upstream.body) {
    return NextResponse.json({ error: "IPFS gateway returned no body" }, { status: 502 });
  }
  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IPFS_GATEWAY_RESPONSE_BYTES) {
      await reader.cancel();
      return NextResponse.json({ error: "IPFS content too large" }, { status: 413 });
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total) as Uint8Array<ArrayBuffer>;
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": safeContentType,
      "X-Content-Type-Options": "nosniff",

      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",

      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",

      "Access-Control-Allow-Origin": "*",
    },
  });
}
