import { test, expect } from "bun:test";
import { isPathAllowed } from "./allowlist";

// Every /v1/intents/<type> creation route the dapp calls (medialane-backend
// src/api/routes/intents/_shared.ts) must be reachable through the proxy —
// this is the exact regression that shipped broken in production on
// 2026-08-04: the allowlist enumerated only mint/create-collection and
// silently 403'd every other intent type (listing, offer, cancel, fulfill,
// checkout, counter-offer, create-tier).
const INTENT_TYPES = [
  "mint", "create-collection", "create-tier",
  "listing", "offer", "cancel", "fulfill", "checkout", "counter-offer",
];

test("POST /v1/intents/<type> is allowed for every known intent type", () => {
  for (const type of INTENT_TYPES) {
    expect(isPathAllowed("POST", `intents/${type}`)).toBe(true);
  }
});

test("POST /v1/intents/<type> is allowed for a hypothetical future intent type", () => {
  // The whole point of the namespace scope over enumeration: a backend
  // route this dapp doesn't call yet must not require a second PR here.
  expect(isPathAllowed("POST", "intents/some-future-type")).toBe(true);
});

test("PATCH /v1/intents/:id/signature and /confirm are allowed for any intent id", () => {
  expect(isPathAllowed("PATCH", "intents/abc-123/signature")).toBe(true);
  expect(isPathAllowed("PATCH", "intents/abc-123/confirm")).toBe(true);
});

test("PATCH /v1/intents/:id/hydrate is NOT allowed (not called from the dapp)", () => {
  expect(isPathAllowed("PATCH", "intents/abc-123/hydrate")).toBe(false);
});

test("GET /v1/intents/:id is allowed (GET /v1/* is allow-all)", () => {
  expect(isPathAllowed("GET", "intents/abc-123")).toBe(true);
});

test("POST /v1/intents/<type> with extra path segments is rejected", () => {
  expect(isPathAllowed("POST", "intents/listing/extra")).toBe(false);
});

test("unrelated POST routes are still rejected", () => {
  expect(isPathAllowed("POST", "admin/accounts/1/credits/grant")).toBe(false);
});
