"use client";

import { uploadFileToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";

export function makeUploadDocument() {
  return async (file: File): Promise<string> => {
    try {
      return (await uploadFileToIpfs(file, "document")).uri;
    } catch (err) {
      const t = uploadFailureToast(err);
      throw new Error(t.description ?? t.title);
    }
  };
}
