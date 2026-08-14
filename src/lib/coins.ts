

import { getService, listServices, type ApiCollection } from "@medialane/sdk";

export { coinKind, formatCoinPrice, formatFdv, type CoinKind } from "@medialane/ui";

export const COIN_SERVICE_IDS: string[] = listServices()
  .filter((s) => s.uiVariant === "coin")
  .map((s) => s.id);

export function isCoinCollection(collection: Pick<ApiCollection, "service">): boolean {
  return getService(collection.service)?.uiVariant === "coin";
}
