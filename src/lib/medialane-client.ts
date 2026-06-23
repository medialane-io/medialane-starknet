import { MedialaneClient } from "@medialane/sdk";
import {
  COLLECTION_1155_CONTRACT,
  COLLECTION_721_CONTRACT,
  MARKETPLACE_1155_CONTRACT,
  MARKETPLACE_721_CONTRACT,
  MEDIALANE_API_KEY,
  MEDIALANE_BACKEND_URL,
} from "./constants";

let _client: MedialaneClient | null = null;

export function getMedialaneClient(): MedialaneClient {
  if (!_client) {
    // The SDK validates rpcUrl as an ABSOLUTE url (z.string().url()) and builds
    // its own RpcProvider from it — so it CANNOT take a relative "/api/rpc".
    // Mirror MEDIALANE_BACKEND_URL: browser → the same-origin proxy made
    // absolute (`origin/api/rpc`, key stays server-side); server → the keyed
    // Alchemy URL directly (a relative proxy URL can't resolve in RSC).
    const rpcUrl =
      typeof window === "undefined"
        ? process.env.ALCHEMY_RPC_URL || process.env.STARKNET_RPC_URL_SERVER || undefined
        : `${window.location.origin}/api/rpc`;
    _client = new MedialaneClient({
      backendUrl: MEDIALANE_BACKEND_URL,
      apiKey: MEDIALANE_API_KEY || undefined,
      rpcUrl,
      marketplaceContract: MARKETPLACE_721_CONTRACT,
      marketplace1155Contract: MARKETPLACE_1155_CONTRACT,
      collectionContract: COLLECTION_721_CONTRACT,
      collection1155Contract: COLLECTION_1155_CONTRACT,
      chain: "STARKNET",
    });
  }
  return _client;
}
