"use client";

import {
  uploadFileToIpfs as uploadFile,
  uploadJsonToIpfs as uploadJson,
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
export const pinAssetMetadata = (input: PinAssetMetadataInput) => pinAsset(api(), input);
