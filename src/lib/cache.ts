import { mutate } from "swr";
import { QUERY_PREFIX, queryKeyPrefix } from "@medialane/ui";

const TOKEN_PREFIXES = [QUERY_PREFIX.tokensOwned, QUERY_PREFIX.token].map(queryKeyPrefix);

const MARKETPLACE_PREFIXES = [
  ...TOKEN_PREFIXES,
  ...[
    QUERY_PREFIX.listings,
    QUERY_PREFIX.userOrders,
    QUERY_PREFIX.order,
    QUERY_PREFIX.counterOffers,
    QUERY_PREFIX.floorListings,
  ].map(queryKeyPrefix),
  "tokens-by-type-",
];

const ORDERS_QUERY = `"op":"${QUERY_PREFIX.orders}"`;

const startsWithAny = (key: unknown, prefixes: string[]) =>
  typeof key === "string" && prefixes.some((prefix) => key.startsWith(prefix));

export const invalidateTokens = () => mutate((key) => startsWithAny(key, TOKEN_PREFIXES));

export const invalidateMarketplace = () =>
  mutate((key) => startsWithAny(key, MARKETPLACE_PREFIXES) || (typeof key === "string" && key.includes(ORDERS_QUERY)));
