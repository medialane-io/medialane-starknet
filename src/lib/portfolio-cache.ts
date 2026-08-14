import { mutate } from "swr";

export function invalidatePortfolioCache(address: string) {
  mutate((key) => typeof key === "string" && key.startsWith(`tokens-owned-${address}-`), undefined, { revalidate: true });
  mutate((key) => typeof key === "string" && key.startsWith(`collections-owner-${address}`), undefined, { revalidate: true });
}
