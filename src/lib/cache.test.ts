import { beforeEach, expect, mock, test } from "bun:test";
import { queryKeys } from "@medialane/ui";

type KeyFilter = (key: unknown) => boolean;
const filters: KeyFilter[] = [];

mock.module("swr", () => ({
  mutate: (filter: KeyFilter) => {
    filters.push(filter);
    return Promise.resolve([]);
  },
}));

const { invalidateMarketplace, invalidateTokens } = await import("./cache");

const contract = "0xabc";
const owner = "0xdef";

beforeEach(() => {
  filters.length = 0;
});

test("token invalidation matches owned and single token keys only", () => {
  invalidateTokens();
  const matches = filters[0];
  expect(matches(queryKeys.tokensOwned(owner, 1, 20))).toBe(true);
  expect(matches(queryKeys.token(contract, "1"))).toBe(true);
  expect(matches(queryKeys.tokenHistory(contract, "1"))).toBe(true);
  expect(matches(queryKeys.listings(contract, "1"))).toBe(false);
  expect(matches(queryKeys.collection(contract))).toBe(false);
  expect(matches(["token", contract])).toBe(false);
});

test("marketplace invalidation matches tokens, orders and listings", () => {
  invalidateMarketplace();
  const matches = filters[0];
  expect(matches(queryKeys.tokensOwned(owner, 1, 20))).toBe(true);
  expect(matches(queryKeys.token(contract, "1"))).toBe(true);
  expect(matches(queryKeys.listings(contract, "1"))).toBe(true);
  expect(matches(queryKeys.userOrders(owner))).toBe(true);
  expect(matches(queryKeys.order("0x1"))).toBe(true);
  expect(matches(queryKeys.counterOffersByOrder("0x1"))).toBe(true);
  expect(matches(queryKeys.floorListings(contract, 10))).toBe(true);
  expect(matches(queryKeys.orders({ status: "ACTIVE" }))).toBe(true);
  expect(matches("tokens-by-type-ERC721")).toBe(true);
});

test("marketplace invalidation leaves unrelated keys alone", () => {
  invalidateMarketplace();
  const matches = filters[0];
  expect(matches(queryKeys.collection(contract))).toBe(false);
  expect(matches(queryKeys.collectionsOwner(owner))).toBe(false);
  expect(matches(["listings", contract])).toBe(false);
  expect(matches(null)).toBe(false);
});
