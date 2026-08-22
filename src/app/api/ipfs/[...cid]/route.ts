import { type NextRequest, NextResponse } from "next/server";
import {
  isValidIpfsCidPath,
  resolveSafeImageContentType,
  MAX_IPFS_GATEWAY_RESPONSE_BYTES,
} from "@medialane/sdk";
import { createRateLimiter } from "@/lib/api-route-guard";
import { readBodyWithCap } from "@/lib/proxy-body";
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
  const safeContentType = resolveSafeImageContentType(upstreamContentType);

  const capped = await readBodyWithCap(upstream, MAX_IPFS_GATEWAY_RESPONSE_BYTES);
  if (!capped.ok) {
    return NextResponse.json({ error: capped.error }, { status: capped.status });
  }
  const body = capped.body;

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
