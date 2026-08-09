import { test, expect } from "bun:test";
import { hasTraversalSegment, isPathAllowed } from "./allowlist";

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

test("POST /v1/reports is NOT allowed through the generic proxy", () => {
  // Reports go exclusively through the dedicated /api/reports route, which
  // computes the canonical targetKey server-side before calling the backend
  // directly. The proxy never had a caller for this path — keep it out.
  expect(isPathAllowed("POST", "reports")).toBe(false);
});

// The allow-all GET rule (`/.+/`) matches a joined path containing `..` as a
// plain string, but `fetch()`'s URL parser collapses `..` at request time —
// so a decoded traversal segment would otherwise pass isPathAllowed and then
// resolve outside /v1/ once fetched. hasTraversalSegment is the guard against
// that, checked on the joined path before it's used to build the target URL.
test("hasTraversalSegment rejects '..' and '.' segments", () => {
  // "../admin/secret" is exactly what Next.js produces for the decoded
  // request path `%2e%2e%2fadmin%2fsecret`: %2f decodes to a literal "/"
  // within a single catch-all segment without re-splitting the segment
  // array, so this traversal must be caught in the *joined* string, not
  // by checking each raw array element for an exact "..".
  expect(hasTraversalSegment("../admin/secret")).toBe(true);
  expect(hasTraversalSegment("admin/../secret")).toBe(true);
  expect(hasTraversalSegment(".")).toBe(true);
});

test("hasTraversalSegment allows normal segments, including dots within a segment", () => {
  expect(hasTraversalSegment("intents/listing")).toBe(false);
  expect(hasTraversalSegment("coins/0x123..abc")).toBe(false);
});
