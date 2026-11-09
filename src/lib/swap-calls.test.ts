import { test, expect } from "bun:test";
import { getTokenBySymbol } from "@medialane/sdk";
import { createSwapIntent } from "./swap-calls";

test("a swap is created by the client, with symbols resolved and the amount to buy sent", async () => {
  const seen: unknown[] = [];
  const intent = { id: "swap1", requiresSignature: false as const, calls: [], expiresAt: "" };
  const client = { createIntent: async (kind: unknown, p: unknown) => { seen.push({ kind, p }); return intent; } };
  expect(await createSwapIntent(client as never, { sellSymbol: "STRK", buySymbol: "USDC", buyAmountRaw: "7", takerAddress: "0xme" })).toEqual(intent);
  expect(seen).toEqual([{ kind: "swap", p: { taker: "0xme", sellTokenAddress: getTokenBySymbol("STRK")!.address, buyTokenAddress: getTokenBySymbol("USDC")!.address, buyAmountRaw: "7" } }]);
});
