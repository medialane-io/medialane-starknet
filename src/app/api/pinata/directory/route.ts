import { NextRequest, NextResponse } from "next/server";
import { getSiwsWallet } from "@/lib/siws-server";
import { buildAssetMetadata, type BuildAssetMetadataInput } from "@/lib/asset-metadata";
import { uploadDirectoryToBackend } from "@/lib/backend-metadata";

export const runtime = "nodejs";
export const maxDuration = 60;

// One item's authoring fields. `creator` + `registrationDate` are injected server-side.
type DropItemFields = Omit<BuildAssetMetadataInput, "creator" | "registrationDate">;

// Pins per-token metadata + a collection.json card file as a single IPFS directory,
// via medialane-backend's metered Pinata path (POST /v1/metadata/upload-directory):
// items[0] → file "1", items[1] → file "2", … so callers set base_uri =
// ipfs://<folderCID>/ → token_uri(N) = ipfs://<folderCID>/N. Each item is encoded
// with buildAssetMetadata — byte-identical to a normal IP asset (OpenSea + Berne
// license attributes), so every drop token is a first-class asset.
export async function POST(req: NextRequest) {
  const wallet = getSiwsWallet(req.headers.get("authorization"));
  if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    items?: DropItemFields[];
    collection?: { name?: string; description?: string; image?: string | null };
  } | null;
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items[] required" }, { status: 400 });
  }
  if (items.length > 2000) {
    return NextResponse.json({ error: "Max 2000 items per drop" }, { status: 400 });
  }
  for (const it of items) {
    if (!it?.name?.trim()) return NextResponse.json({ error: "Every item needs a name" }, { status: 400 });
    if (it.imageUri && !it.imageUri.startsWith("ipfs://")) {
      return NextResponse.json({ error: "imageUri must be an ipfs:// URI" }, { status: 400 });
    }
  }
  if (body?.collection?.image && !body.collection.image.startsWith("ipfs://")) {
    return NextResponse.json({ error: "collection.image must be an ipfs:// URI" }, { status: 400 });
  }

  // Creator = the authenticated SIWS wallet — never trusted from the client.
  const creator = wallet;
  const registrationDate = new Date().toISOString().split("T")[0];

  const files: { name: string; content: unknown }[] = items.map((fields, i) => ({
    name: String(i + 1), // contract mints sequentially from token id 1
    content: buildAssetMetadata({ ...fields, creator, registrationDate }),
  }));

  files.push({
    name: "collection.json",
    content: {
      name: body?.collection?.name ?? "",
      description: body?.collection?.description ?? "",
      image: body?.collection?.image ?? null,
    },
  });

  try {
    const { cid, baseUri } = await uploadDirectoryToBackend(files);
    return NextResponse.json({ cid, baseUri });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Directory pin failed";
    console.error("[/api/pinata/directory]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
