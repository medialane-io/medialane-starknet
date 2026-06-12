"use client";

import { uploadFileToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";

/** Builds the IPTypeFields `uploadDocument` callback over the dapp's SIWS rail.
 *  Resolves to the ipfs:// URI stored as the "Document File" trait; errors are
 *  remapped to friendly messages (signature declined, etc.). */
export function makeUploadDocument(getValidToken: () => Promise<string | null>) {
  return async (file: File): Promise<string> => {
    try {
      const token = await getValidToken();
      if (!token) throw new Error("Connect your wallet first");
      return (await uploadFileToIpfs(file, token)).uri;
    } catch (err) {
      const t = uploadFailureToast(err);
      throw new Error(t.description ?? t.title);
    }
  };
}
