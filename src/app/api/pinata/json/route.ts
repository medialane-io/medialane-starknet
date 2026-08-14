

import { NextRequest, NextResponse } from "next/server";
import { getSiwsWallet } from "@/lib/siws-server";
import { uploadJsonToBackend } from "@/lib/backend-metadata";

export async function POST(req: NextRequest) {
  if (!getSiwsWallet(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "JSON object body required" }, { status: 400 });
  }

  try {
    const { uri, cid } = await uploadJsonToBackend(body);
    return NextResponse.json({ uri, cid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[pinata/json] upload failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
