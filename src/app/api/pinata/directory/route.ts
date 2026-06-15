import { NextRequest, NextResponse } from "next/server";
import { getSiwsWallet } from "@/lib/siws-server";
import { buildAssetMetadata, type BuildAssetMetadataInput } from "@/lib/asset-metadata";

export const runtime = "nodejs";
export const maxDuration = 60;

// One item's authoring fields. `creator` + `registrationDate` are injected server-side.
type DropItemFields = Omit<BuildAssetMetadataInput, "creator" | "registrationDate">;

// Pins per-token metadata + a collection.json card file as a single IPFS directory.
// VERIFIED shape (2026-06-15): files must share a folder path (drop/<id>) with
// wrapWithDirectory:false; Pinata returns the folder CID so children resolve at
// <cid>/<tokenId> and <cid>/collection.json. token_uri(N) = ipfs://<cid>/N → unique,
// fully-licensed asset, identical standard to any other Medialane IP asset.
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

  const jwt = process.env.PINATA_JWT;
  if (!jwt) return NextResponse.json({ error: "Pinata not configured" }, { status: 500 });

  // Creator = the authenticated SIWS wallet — never trusted from the client.
  const creator = wallet;
  const registrationDate = new Date().toISOString().split("T")[0];

  const form = new FormData();
  items.forEach((fields, i) => {
    const tokenId = i + 1; // contract mints sequentially from token id 1
    const metadata = buildAssetMetadata({ ...fields, creator, registrationDate });
    const blob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
    form.append("file", blob, `drop/${tokenId}`);
  });

  const collection = {
    name: body?.collection?.name ?? "",
    description: body?.collection?.description ?? "",
    image: body?.collection?.image ?? null,
  };
  form.append("file", new Blob([JSON.stringify(collection)], { type: "application/json" }), "drop/collection.json");

  form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: false }));
  form.append("pinataMetadata", JSON.stringify({ name: `drop-metadata-${Date.now()}` }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Pinata error: ${text}` }, { status: 502 });
  }
  const json = (await res.json()) as { IpfsHash: string };
  return NextResponse.json({ cid: json.IpfsHash, baseUri: `ipfs://${json.IpfsHash}/` });
}
