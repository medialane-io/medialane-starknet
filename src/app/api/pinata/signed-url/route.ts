/**
 * POST /api/pinata/signed-url
 *
 * Returns a short-lived Pinata signed upload URL so the client can upload
 * files directly to Pinata without routing the bytes through this server —
 * Vercel caps serverless request bodies at ~4.5 MB (413), so anything larger
 * must bypass it.
 *
 * Body (JSON, optional): { kind?: "image" | "document" } — defaults to "image"
 * (existing image callers POST with no body).
 *
 * Response: { url: string }
 */

import { type NextRequest, NextResponse } from "next/server";
import { getSiwsWallet } from "@/lib/siws-server";
import { getPinataClient } from "@/lib/pinata";

const MIME_TYPES: Record<"image" | "document", string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "application/rtf",
    "text/plain",
    "text/markdown",
    // Browsers report .md/.rtf/.odt inconsistently — often as octet-stream.
    // Auth + size cap + 2-minute expiry are the real guards here.
    "application/octet-stream",
  ],
};

const MAX_BYTES: Record<"image" | "document", number> = {
  image: 10 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

export async function POST(req: NextRequest) {
  if (!getSiwsWallet(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind: "image" | "document" = body.kind === "document" ? "document" : "image";

  try {
    const pinata = getPinataClient();
    const url = await pinata.upload.public.createSignedURL({
      expires: 120, // 2 minutes — enough for slow connections
      maxFileSize: MAX_BYTES[kind],
      mimeTypes: MIME_TYPES[kind],
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[/api/pinata/signed-url]", err);
    const message = err instanceof Error ? err.message : "Failed to create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
