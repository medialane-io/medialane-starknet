import type { Call } from "starknet";
import { getTokenBySymbol, type ApiClient } from "@medialane/sdk";

function tokenAddress(symbol: string): string {
  const token = getTokenBySymbol(symbol);
  if (!token) throw new Error(`Unsupported currency: ${symbol}`);
  return token.address;
}

export async function createSwapIntent(
  api: Pick<ApiClient, "createSwapIntent">,
  params: { sellSymbol: string; buySymbol: string; buyAmountRaw: string; takerAddress: string },
): Promise<{ id: string; calls: Call[] }> {
  const created = await api.createSwapIntent({
    taker: params.takerAddress,
    sellTokenAddress: tokenAddress(params.sellSymbol),
    buyTokenAddress: tokenAddress(params.buySymbol),
    buyAmountRaw: params.buyAmountRaw,
  });
  const intent = created.data as { id: string; calls: Call[] };
  return { id: intent.id, calls: intent.calls };
}
