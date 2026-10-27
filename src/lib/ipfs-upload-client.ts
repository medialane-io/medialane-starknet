"use client";

import {
  uploadFileToIpfs as uploadFile,
  uploadJsonToIpfs as uploadJson,
  type SignedUploadKind,
} from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export type { SignedUploadKind };

const api = () => getMedialaneClient().api;

export const uploadFileToIpfs = (file: File, kind?: SignedUploadKind) => uploadFile(api(), file, kind);
export const uploadJsonToIpfs = (payload: unknown) => uploadJson(api(), payload);
