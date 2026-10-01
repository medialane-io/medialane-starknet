import { usePlatformStats as usePlatformStatsBase } from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export const usePlatformStats = () => usePlatformStatsBase(getMedialaneClient);
