"use client";

import { uploadFileToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";

export function makeUploadDocument(getValidToken: () => Promise<string | null>) {
  return async (file: File): Promise<string> => {
    try {
      const token = await getValidToken();
      if (!token) throw new Error("Connect your wallet first");
      return (await uploadFileToIpfs(file, token, "document")).uri;
    } catch (err) {
      const t = uploadFailureToast(err);
      throw new Error(t.description ?? t.title);
    }
  };
}
