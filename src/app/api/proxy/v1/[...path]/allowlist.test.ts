import { test, expect } from "bun:test";
import { hasTraversalSegment, isPathAllowed } from "./allowlist";

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

test("POST /v1/reports is NOT allowed through the generic proxy", () => {

  expect(isPathAllowed("POST", "reports")).toBe(false);
});

test("hasTraversalSegment rejects '..' and '.' segments", () => {

  expect(hasTraversalSegment("../admin/secret")).toBe(true);
  expect(hasTraversalSegment("admin/../secret")).toBe(true);
  expect(hasTraversalSegment(".")).toBe(true);
});

test("hasTraversalSegment allows normal segments, including dots within a segment", () => {
  expect(hasTraversalSegment("intents/listing")).toBe(false);
  expect(hasTraversalSegment("coins/0x123..abc")).toBe(false);
});
