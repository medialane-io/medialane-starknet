import { test, expect } from "bun:test";
import { getTokenBySymbol } from "@medialane/sdk";
import { createSwapIntent } from "./swap-calls";

test("symbols resolve to addresses and the amount to buy is sent", async () => {
  const seen: unknown[] = [];
  const api = { createSwapIntent: async (p: unknown) => { seen.push(p); return { data: { id: "swap1", requiresSignature: false as const, calls: [], expiresAt: "" } }; } };
  expect(await createSwapIntent(api, { sellSymbol: "STRK", buySymbol: "USDC", buyAmountRaw: "7", takerAddress: "0xme" })).toEqual({ id: "swap1", calls: [] });
  expect(seen).toEqual([{ taker: "0xme", sellTokenAddress: getTokenBySymbol("STRK")!.address, buyTokenAddress: getTokenBySymbol("USDC")!.address, buyAmountRaw: "7" }]);
});
