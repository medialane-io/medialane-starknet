import type { Call } from "starknet";
import { serializeByteArray } from "./cairo-calldata";
import { MINT_CONTRACT, GENESIS_NFT_URI } from "./constants";

export function genesisMintCall(recipient: string): Call {
  return {
    contractAddress: MINT_CONTRACT,
    entrypoint: "mint_item",
    calldata: [recipient, ...serializeByteArray(GENESIS_NFT_URI)],
  };
}
