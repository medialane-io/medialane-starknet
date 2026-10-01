"use client";

import { useNotifications as useNotificationsBase } from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export function useNotifications(address: string | null | undefined) {
  return useNotificationsBase(getMedialaneClient, address);
}
