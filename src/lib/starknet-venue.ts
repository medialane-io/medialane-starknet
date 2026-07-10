import { StarknetVenue, type ResolvedOrder } from "@medialane/sdk/starknet";
import { resolveConfig } from "@medialane/sdk";
import { RpcProvider } from "starknet";
import { getMedialaneClient, medialaneConfig } from "./medialane-client";
import { dappFeeConfig } from "./fee";

/**
 * The app's single marketplace-protocol boundary: the chain-neutral
 * `StarknetVenue` adapter (Stage 0 of the multichain port). Feature code and the
 * `useMarketplace` hook talk to this, not to `MedialaneClient.marketplace` or raw
 * ABIs. `feeConfig` is wired in so the SDK composes the identical creators-fund
 * fee the app used to hand-roll.
 */
let _venue: StarknetVenue | null = null;

export function getStarknetVenue(): StarknetVenue {
  if (_venue) return _venue;
  const client = getMedialaneClient();
  const cfg = medialaneConfig();
  const config = resolveConfig({ ...cfg, feeConfig: dappFeeConfig });
  const provider = new RpcProvider({ nodeUrl: cfg.rpcUrl });

  const resolveStandard = async (contract: string): Promise<"ERC721" | "ERC1155"> => {
    const { data } = await client.api.getCollection(contract);
    return data.standard === "ERC1155" ? "ERC1155" : "ERC721";
  };

  const resolveOrder = async (orderRef: string): Promise<ResolvedOrder> => {
    const { data: order } = await client.api.getOrder(orderRef);
    const standard = order.nftContract ? await resolveStandard(order.nftContract) : "ERC721";
    return {
      paymentToken: order.consideration.token,
      // order.price is the per-unit price; the venue multiplies by quantity.
      unitPrice: order.price.raw ?? "0",
      standard,
    };
  };

  _venue = new StarknetVenue({ config, provider, resolveOrder, resolveStandard });
  return _venue;
}
