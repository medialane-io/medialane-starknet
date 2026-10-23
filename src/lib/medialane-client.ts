import { MedialaneClient } from "@medialane/sdk/starknet";
import {
  STARKNET_COLLECTION_1155_CONTRACT,
  STARKNET_COLLECTION_721_CONTRACT,
  STARKNET_MARKETPLACE_1155_CONTRACT,
  STARKNET_MARKETPLACE_721_CONTRACT,
  MEDIALANE_API_KEY,
  MEDIALANE_BACKEND_URL,
} from "./constants";

let _client: MedialaneClient | null = null;

function medialaneConfig() {
  return {
    backendUrl: MEDIALANE_BACKEND_URL,
    apiKey: MEDIALANE_API_KEY || undefined,
    marketplace721Contract: STARKNET_MARKETPLACE_721_CONTRACT,
    marketplace1155Contract: STARKNET_MARKETPLACE_1155_CONTRACT,
    collection721Contract: STARKNET_COLLECTION_721_CONTRACT,
    collection1155Contract: STARKNET_COLLECTION_1155_CONTRACT,
    chain: "STARKNET" as const,
  };
}

export function getMedialaneClient(): MedialaneClient {
  if (!_client) _client = new MedialaneClient(medialaneConfig());
  return _client;
}
