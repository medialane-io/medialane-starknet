// Pure coin helpers now live in @medialane/ui (chain-agnostic, shared with io).
// This file re-exports them and keeps the SDK/registry-dependent helpers
// (isCoinCollection / COIN_SERVICE_IDS) app-side — ui stays SDK-free.

import { getService, listServices, type ApiCollection } from "@medialane/sdk";

export { coinKind, formatCoinPrice, formatFdv, type CoinKind } from "@medialane/ui";

/** Service IDs whose uiVariant is "coin" — resolved from the registry, not hardcoded. */
export const COIN_SERVICE_IDS: string[] = listServices()
  .filter((s) => s.uiVariant === "coin")
  .map((s) => s.id);

/** True when a Collection should render as a coin (ERC-20 swap surface). */
export function isCoinCollection(collection: Pick<ApiCollection, "service">): boolean {
  return getService(collection.service)?.uiVariant === "coin";
}
