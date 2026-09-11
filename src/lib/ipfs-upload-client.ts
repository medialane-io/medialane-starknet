"use client";

import { buildAssetMetadata, type BuildAssetMetadataInput } from "@medialane/sdk";

export interface UploadedIpfsFile {
  cid: string;
  uri: string;
}

export async function uploadFileToIpfs(
  file: File,
  kind: "image" | "document" | "media" = "image",
): Promise<UploadedIpfsFile> {
  const signedRes = await fetch(`/api/proxy/v1/metadata/signed-url?kind=${kind}`);
  const signed = (await signedRes.json().catch(() => ({}))) as {
    data?: { url?: string };
    error?: string;
  };
  const uploadUrl = signed.data?.url;
  if (!signedRes.ok || !uploadUrl) {
    throw new Error(signed.error ?? "Failed to get upload URL");
  }

  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("network", "public");
  formData.append("name", file.name);

  const uploadRes = await fetch(uploadUrl, { method: "POST", body: formData });
  const uploadJson = (await uploadRes.json().catch(() => ({}))) as { data?: { cid?: string } };
  const cid = uploadJson.data?.cid;
  if (!uploadRes.ok || !cid) {
    throw new Error("Image upload to IPFS failed");
  }

  return { cid, uri: `ipfs://${cid}` };
}

export async function uploadJsonToIpfs(payload: unknown): Promise<string> {
  const res = await fetch("/api/proxy/v1/metadata/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { url?: string };
    error?: string;
  };
  const uri = body.data?.url;
  if (!res.ok || !uri) {
    throw new Error(body.error ?? "Metadata upload failed");
  }
  return uri;
}

export interface PinAssetMetadataInput extends Omit<BuildAssetMetadataInput, "registrationDate"> {
  imageFile?: File | null;
}

export async function pinAssetMetadata(
  input: PinAssetMetadataInput,
): Promise<{ uri: string; imageUri: string | null }> {
  const { imageFile, ...fields } = input;

  let imageUri = fields.imageUri ?? null;
  if (!imageUri && imageFile && imageFile.size > 0) {
    imageUri = (await uploadFileToIpfs(imageFile)).uri;
  }

  const uri = await uploadJsonToIpfs(
    buildAssetMetadata({
      ...fields,
      imageUri,
      externalUrl: fields.externalUrl || "https://medialane.io",
    }),
  );

  return { uri, imageUri };
}
