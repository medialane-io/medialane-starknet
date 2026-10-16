import { test, expect } from "bun:test";
import { orderTotal } from "@/lib/checkout";
import type { ApiOrder } from "@medialane/sdk";

const ONE_STRK = 10n ** 18n;

function order(itemType: "ERC721" | "ERC1155", editions = "1"): ApiOrder {
  return {
    offer: { itemType, startAmount: editions },
    consideration: { startAmount: ONE_STRK.toString() },
  } as unknown as ApiOrder;
}

test("ERC-1155: charges price per edition × quantity", () => {
  expect(orderTotal(order("ERC1155"), 2)).toBe(2n * ONE_STRK);
  expect(orderTotal(order("ERC1155"), 1)).toBe(ONE_STRK);
  expect(orderTotal(order("ERC1155"), 7)).toBe(7n * ONE_STRK);
});

test("ERC-1155: does NOT divide by the listing edition count (regression)", () => {

  expect(orderTotal(order("ERC1155", "5"), 2)).toBe(2n * ONE_STRK);
});

test("ERC-721: always the single consideration amount", () => {
  expect(orderTotal(order("ERC721"), 1)).toBe(ONE_STRK);
});

import { checkoutExecution } from "@/lib/checkout";

test("checkout runs the swap intent first, then every fulfill intent, with all their ids", () => {
  const swap = { id: "s", calls: [{ contractAddress: "0xa", entrypoint: "swap", calldata: [] }] };
  const items = [
    { id: "f1", calls: [{ contractAddress: "0xm", entrypoint: "fulfill_order", calldata: ["1"] }] },
    { id: "f2", calls: [{ contractAddress: "0xm", entrypoint: "fulfill_order", calldata: ["2"] }] },
  ];
  expect(checkoutExecution(items, swap)).toEqual({
    calls: [...swap.calls, ...items[0]!.calls, ...items[1]!.calls],
    intentIds: ["s", "f1", "f2"],
  });
  expect(checkoutExecution(items).intentIds).toEqual(["f1", "f2"]);
});

import { amountDue } from "@/lib/checkout";

test("the amount due adds the 1% platform fee the purchase transfers", () => {
  expect(amountDue(order("ERC721"), 1)).toBe(ONE_STRK + ONE_STRK / 100n);
  expect(amountDue(order("ERC1155"), 3)).toBe(3n * ONE_STRK + (3n * ONE_STRK) / 100n);
});
