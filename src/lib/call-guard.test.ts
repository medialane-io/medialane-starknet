import { expect, test } from "bun:test";
import { assertNoSelfCalls } from "./call-guard";

const account = "0xc9c29971b48b8e485fbbf4f2d5f0bd2dfbf6a5369e08e2d9";
const other = "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const call = (contractAddress: string) => ({ contractAddress, entrypoint: "approve", calldata: [] });

test("calls to other contracts pass", () => {
  expect(() => assertNoSelfCalls([call(other), call(other)], account)).not.toThrow();
});

test("a call to the signer's own account is rejected", () => {
  expect(() => assertNoSelfCalls([call(other), call(account)], account)).toThrow("own wallet account");
});

test("address padding and case do not hide a self call", () => {
  const padded = "0x00" + account.slice(2).toUpperCase();
  expect(() => assertNoSelfCalls([call(padded)], account)).toThrow();
});
