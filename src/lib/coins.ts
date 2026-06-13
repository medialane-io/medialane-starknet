import { getService, listServices, type ApiCollection } from "@medialane/sdk";

export type CoinKind = "creator" | "memecoin";

/** Service IDs whose uiVariant is "coin" — resolved from the registry, not hardcoded. */
export const COIN_SERVICE_IDS: string[] = listServices()
  .filter((s) => s.uiVariant === "coin")
  .map((s) => s.id);

/** True when a Collection should render as a coin (ERC-20 swap surface). */
export function isCoinCollection(collection: Pick<ApiCollection, "service">): boolean {
  return getService(collection.service)?.uiVariant === "coin";
}

/** Native creator coin vs claimed external memecoin. */
export function coinKind(service: string | null | undefined): CoinKind {
  return service === "external-erc20" ? "memecoin" : "creator";
}

/** Format a quote-per-coin spot price (matches the coin page's formatPrice). */
export function formatCoinPrice(n: number): string {
  if (n === 0) return "0";
  if (n < 0.000001) return n.toExponential(2);
  if (n < 1) return n.toPrecision(3);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Fully-diluted value = price x total supply, abbreviated, in the quote symbol.
 *  Returns null when price or supply is unknown. */
export function formatFdv(
  quotePerCoin: number | null | undefined,
  totalSupply: number | null | undefined,
  quoteSymbol: string | null | undefined
): string | null {
  // Treat 0/unknown supply as unknown FDV ("—") — external coins aren't
  // supply-indexed, so `price × 0` would otherwise render a misleading "0".
  if (quotePerCoin == null || !totalSupply) return null;
  const fdv = quotePerCoin * totalSupply;
  const sym = quoteSymbol ?? "";
  const abbr =
    fdv >= 1_000_000_000 ? `${(fdv / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}B` :
    fdv >= 1_000_000     ? `${(fdv / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M` :
    fdv >= 1_000         ? `${(fdv / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K` :
                           fdv.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return sym ? `${abbr} ${sym}` : abbr;
}
