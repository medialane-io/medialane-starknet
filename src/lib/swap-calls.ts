import { getTokenBySymbol, type ApiIntentCreated, type IntentsApi } from "@medialane/sdk";

function tokenAddress(symbol: string): string {
  const token = getTokenBySymbol(symbol);
  if (!token) throw new Error(`Unsupported currency: ${symbol}`);
  return token.address;
}

export async function createSwapIntent(
  api: { intents: Pick<IntentsApi, "create"> },
  params: { sellSymbol: string; buySymbol: string; buyAmountRaw: string; takerAddress: string },
): Promise<ApiIntentCreated> {
  return api.intents.create("swap", {
    taker: params.takerAddress,
    sellTokenAddress: tokenAddress(params.sellSymbol),
    buyTokenAddress: tokenAddress(params.buySymbol),
    buyAmountRaw: params.buyAmountRaw,
  });
}
