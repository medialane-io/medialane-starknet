import useSWR from "swr";
import type { ApiPlatformStats } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";

export function usePlatformStats() {
  const { data, isLoading } = useSWR<ApiPlatformStats>(
    "platform-stats",
    () => getMedialaneClient().api.getPlatformStats(),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  return { stats: data ?? null, isLoading };
}
