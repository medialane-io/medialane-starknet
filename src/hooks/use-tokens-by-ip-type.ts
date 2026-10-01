"use client";

import { useTokensByIpType as useTokensByIpTypeBase } from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export const useTokensByIpType = (ipTypeSlug: string | null, page = 1, limit = 24) =>
  useTokensByIpTypeBase(getMedialaneClient, ipTypeSlug, page, limit);
