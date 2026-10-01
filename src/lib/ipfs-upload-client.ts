"use client";

import {
  uploadFileToIpfs as uploadFile,
  uploadJsonToIpfs as uploadJson,
  uploadDirectoryToIpfs as uploadDirectory,
  pinAssetMetadata as pinAsset,
  type SignedUploadKind,
  type UploadedIpfsFile,
  type PinAssetMetadataInput,
  type PinnedAsset,
} from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export type { SignedUploadKind, UploadedIpfsFile, PinAssetMetadataInput, PinnedAsset };

const api = () => getMedialaneClient().api;

export const uploadFileToIpfs = (file: File, kind?: SignedUploadKind) => uploadFile(api(), file, kind);
export const uploadJsonToIpfs = (payload: unknown) => uploadJson(api(), payload);
export const uploadDirectoryToIpfs = (files: { name: string; content: unknown }[]) => uploadDirectory(api(), files);
export const pinAssetMetadata = (input: PinAssetMetadataInput) => pinAsset(api(), input);
