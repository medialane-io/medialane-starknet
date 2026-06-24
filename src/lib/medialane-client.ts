import { MedialaneClient } from "@medialane/sdk";
import {
  STARKNET_COLLECTION_1155_CONTRACT,
  STARKNET_COLLECTION_721_CONTRACT,
  STARKNET_MARKETPLACE_1155_CONTRACT,
  STARKNET_MARKETPLACE_721_CONTRACT,
  MEDIALANE_API_KEY,
  MEDIALANE_BACKEND_URL,
  RPC_MAIN_URL,
  RPC_FALLBACK_URL,
  RPC_PROXY_PATH,
} from "./constants";

let _client: MedialaneClient | null = null;

export function getMedialaneClient(): MedialaneClient {
  if (!_client) {
    // The SDK validates rpcUrl as an ABSOLUTE url (z.string().url()) and builds
    // its own RpcProvider — so it can't take a relative "/api/rpc", and it must
    // never be empty (that crashed the /_not-found prerender). Browser → the
    // same-origin proxy made absolute (key stays server-side); server → the
    // keyed MAIN, then the keyless FALLBACK (which always has a value).
    const rpcUrl =
      typeof window === "undefined"
        ? RPC_MAIN_URL || RPC_FALLBACK_URL
        : `${window.location.origin}${RPC_PROXY_PATH}`;
    _client = new MedialaneClient({
      backendUrl: MEDIALANE_BACKEND_URL,
      apiKey: MEDIALANE_API_KEY || undefined,
      rpcUrl,
      marketplaceContract: STARKNET_MARKETPLACE_721_CONTRACT,
      marketplace1155Contract: STARKNET_MARKETPLACE_1155_CONTRACT,
      collectionContract: STARKNET_COLLECTION_721_CONTRACT,
      collection1155Contract: STARKNET_COLLECTION_1155_CONTRACT,
      chain: "STARKNET",
    });
  }
  return _client;
}
