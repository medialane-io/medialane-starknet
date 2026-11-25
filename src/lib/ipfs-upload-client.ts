"use client";

import { uploadJsonToIpfs as uploadJson } from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export const uploadJsonToIpfs = (payload: unknown) => uploadJson(getMedialaneClient().api, payload);
