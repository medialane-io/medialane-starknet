import { expect, test } from "bun:test";
import { readBalance, tokenBalanceKey } from "./use-token-balance";

test("no balance is read without a wallet", () => {
  expect(tokenBalanceKey("STRK", undefined)).toBeNull();
});

test("a balance is read per token and per wallet", () => {
  const key = tokenBalanceKey("STRK", "0x1");
  expect(key).toEqual(["token-balance", "STRK", "0x1"]);
  expect(tokenBalanceKey("STRK", "0x2")).not.toEqual(key);
  expect(tokenBalanceKey("ETH", "0x1")).not.toEqual(key);
});

test("a token the platform does not list is refused", async () => {
  await expect(readBalance("NOPE", "0x1")).rejects.toThrow("Unknown token symbol: NOPE");
});
