"use client";

import { LaunchpadPage } from "@medialane/ui";
import { FastMint } from "@/components/launchpad/fast-mint";

export function LaunchpadContent() {
  return <LaunchpadPage fastMint={<FastMint />} />;
}
