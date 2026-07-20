import { useReadContract } from "@starknet-react/core";
import { Abi, cairo, num } from "starknet";
import { IPNftABI as COLLECTION_NFT_ABI } from "@medialane/sdk/starknet";

export interface FullTokenData {
  owner: string;
  metadataUri: string;
  originalCreator: string;
  registeredAt: number; // unix seconds
}

interface UseFullTokenDataArgs {
  ipNftAddress: string | undefined;
  tokenId: bigint | undefined;
}

/**
 * Wraps the audited IPNft.get_full_token_data view.
 * Returns owner + metadata URI + original creator + mint timestamp in a single read.
 * Use this instead of separate owner_of / token_uri / get_token_creator calls.
 */
export function useFullTokenData({ ipNftAddress, tokenId }: UseFullTokenDataArgs) {
  const enabled = Boolean(ipNftAddress && tokenId !== undefined);

  const { data, isLoading, error, refetch } = useReadContract({
    abi: COLLECTION_NFT_ABI as unknown as Abi,
    functionName: "get_full_token_data",
    address: enabled ? (ipNftAddress as `0x${string}`) : undefined,
    args: enabled && tokenId !== undefined ? [cairo.uint256(tokenId)] : undefined,
    watch: false,
  });

  if (!data) {
    return { data: null as FullTokenData | null, isLoading, error, refetch };
  }

  // Cairo tuple decoded by starknet.js: [owner, metadata_uri, original_creator, registered_at]
  const tuple = data as unknown as [bigint, string, bigint, bigint];
  const parsed: FullTokenData = {
    owner: num.toHex(tuple[0]),
    metadataUri: tuple[1],
    originalCreator: num.toHex(tuple[2]),
    registeredAt: Number(tuple[3]),
  };
  return { data: parsed, isLoading, error, refetch };
}
