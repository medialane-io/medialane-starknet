/**
 * POST /api/pinata/image
 *
 * Uploads a single image file to IPFS via medialane-backend's metered Pinata path.
 * Requires a valid SIWS wallet session.
 *
 * Accepts multipart/form-data:
 *   file  File  — image (JPG/PNG/GIF/SVG/WebP, max 10 MB)
 *
 * Response: { imageUri: "ipfs://...", cid: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSiwsWallet } from "@/lib/siws-server";
import { uploadFileToBackend } from "@/lib/backend-metadata";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
  "image/webp",
]);

export async function POST(req: NextRequest) {
  if (!getSiwsWallet(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 4 MB" }, { status: 400 });
  }

  try {
    const { uri, cid } = await uploadFileToBackend(file);
    return NextResponse.json({ imageUri: uri, cid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[pinata/image] upload failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
