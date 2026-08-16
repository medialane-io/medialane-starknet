import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL!;
const API_KEY = process.env.MEDIALANE_API_KEY!;

const checkRateLimit = createRateLimiter(60_000, 5);

function normalizeAddress(addr: string): string {
  const hex = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + hex.padStart(64, "0");
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
    targetType: "TOKEN" | "COLLECTION" | "CREATOR" | "COMMENT";
    targetContract?: string;
    targetTokenId?: string;
    targetAddress?: string;
    targetId?: string;
    categories: string[];
    description?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.targetType || !body.categories?.length) {
    return NextResponse.json(
      { error: "targetType and categories are required" },
      { status: 400 }
    );
  }

  const validTypes = ["TOKEN", "COLLECTION", "CREATOR", "COMMENT"];
  if (!validTypes.includes(body.targetType)) {
    return NextResponse.json({ error: "Invalid targetType" }, { status: 400 });
  }

  const normalizedContract = body.targetContract
    ? normalizeAddress(body.targetContract)
    : undefined;
  const normalizedAddress = body.targetAddress
    ? normalizeAddress(body.targetAddress)
    : undefined;

  let targetKey: string;
  if (body.targetType === "TOKEN" && normalizedContract && body.targetTokenId) {
    targetKey = `TOKEN:${normalizedContract}:${body.targetTokenId}`;
  } else if (body.targetType === "COLLECTION" && normalizedContract) {
    targetKey = `COLLECTION:${normalizedContract}`;
  } else if (body.targetType === "CREATOR" && normalizedAddress) {
    targetKey = `CREATOR:${normalizedAddress}`;
  } else if (body.targetType === "COMMENT" && body.targetId) {
    targetKey = `COMMENT::${body.targetId}`;
  } else {
    return NextResponse.json(
      { error: "Invalid target fields for targetType" },
      { status: 400 }
    );
  }

  const backendHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  };
  const siwsToken = req.headers.get("X-Siws-Token");
  if (siwsToken) backendHeaders["Authorization"] = `Bearer ${siwsToken}`;

  const res = await fetch(`${BACKEND_URL}/v1/reports`, {
    method: "POST",
    headers: backendHeaders,
    body: JSON.stringify({
      targetType: body.targetType,
      targetKey,
      targetContract: normalizedContract,
      targetTokenId: body.targetTokenId,
      targetAddress: normalizedAddress,
      targetId: body.targetId,
      categories: body.categories,
      description: body.description,
    }),
  });

  if (res.status === 409) {
    return NextResponse.json({ error: "Already reported" }, { status: 409 });
  }
  if (res.status === 429) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
