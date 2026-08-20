"use client";

import { withSiwsAuth } from "@/lib/pinata-fetch";

export interface UploadedIpfsFile {
  cid: string;
  uri: string;
}

export async function uploadFileToIpfs(
  file: File,
  siwsToken: string,
  kind: "image" | "document" | "media" = "image",
): Promise<UploadedIpfsFile> {
  const signedRes = await fetch("/api/pinata/signed-url", withSiwsAuth(siwsToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  }));
  const signedData = await signedRes.json().catch(() => ({})) as { url?: string };
  if (!signedRes.ok || !signedData.url) {
    throw new Error("Failed to get upload URL");
  }

  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("network", "public");
  formData.append("name", file.name);

  const uploadRes = await fetch(signedData.url, { method: "POST", body: formData });
  if (!uploadRes.ok) {
    throw new Error("Image upload to IPFS failed");
  }

  const uploadJson = await uploadRes.json().catch(() => ({})) as {
    data?: { cid?: string };
  };
  const cid = uploadJson.data?.cid;
  if (!cid) {
    throw new Error("Image upload returned no CID");
  }

  return { cid, uri: `ipfs://${cid}` };
}

export async function uploadJsonToIpfs(
  payload: unknown,
  siwsToken: string,
): Promise<string> {
  const res = await fetch("/api/pinata/json", withSiwsAuth(siwsToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
  const data = await res.json().catch(() => ({})) as { uri?: string; error?: string };

  if (!res.ok || !data.uri) {
    throw new Error(data.error ?? "Metadata upload failed");
  }

  return data.uri;
}
