import { getTokenBySymbol, type ApiIntentCreated } from "@medialane/sdk";
import type { MedialaneClient } from "@medialane/sdk/starknet";

function tokenAddress(symbol: string): string {
  const token = getTokenBySymbol(symbol);
  if (!token) throw new Error(`Unsupported currency: ${symbol}`);
  return token.address;
}

export async function createSwapIntent(
  client: Pick<MedialaneClient, "createIntent">,
  params: { sellSymbol: string; buySymbol: string; buyAmountRaw: string; takerAddress: string },
): Promise<ApiIntentCreated> {
  return client.createIntent("swap", {
    taker: params.takerAddress,
    sellTokenAddress: tokenAddress(params.sellSymbol),
    buyTokenAddress: tokenAddress(params.buySymbol),
    buyAmountRaw: params.buyAmountRaw,
  });
}
