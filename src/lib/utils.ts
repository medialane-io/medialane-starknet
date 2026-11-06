import { normalizeAddress } from "@medialane/sdk";
import { createImageResolver, PINATA_PUBLIC_GATEWAY } from "@medialane/ui";
import { IPFS_GATEWAY } from "./constants";

export const resolveImage = createImageResolver({ gateway: IPFS_GATEWAY ?? PINATA_PUBLIC_GATEWAY, proxyPath: "/api/img" });

export function isCollectionOwner(
  collection: { owner?: string | null } | null | undefined,
  walletAddress: string | null | undefined
): boolean {
  if (!collection?.owner || !walletAddress) return false;
  return (
    normalizeAddress("STARKNET", collection.owner) ===
    normalizeAddress("STARKNET", walletAddress)
  );
}
