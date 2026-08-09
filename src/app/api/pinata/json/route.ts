/**
 * POST /api/pinata/json
 *
 * Uploads a JSON document to Pinata/IPFS.
 * Requires a valid SIWS wallet session.
 *
 * Accepts: application/json body (any JSON object)
 * Response: { uri: "ipfs://...", cid: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSiwsWallet } from "@/lib/siws-server";
import { getPinataClient } from "@/lib/pinata";

export async function POST(req: NextRequest) {
  if (!getSiwsWallet(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "JSON object body required" }, { status: 400 });
  }

  try {
    const pinata = getPinataClient();
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    const file = new File([blob], "metadata.json", { type: "application/json" });
    const upload = await pinata.upload.public.file(file);
    const uri = `ipfs://${upload.cid}`;
    return NextResponse.json({ uri, cid: upload.cid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[pinata/json] upload failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
