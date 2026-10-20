import { test, expect } from "bun:test";
import { resolveImage, isCollectionOwner } from "./utils";

test("resolveImage routes known IPFS gateway URLs to Pinata's public gateway directly", () => {
  const result = resolveImage("https://gateway.pinata.cloud/ipfs/abc123");
  expect(result.startsWith("https://gateway.pinata.cloud/ipfs/abc123")).toBe(true);
});

test("resolveImage routes unrecognized https URLs through the generic image proxy", () => {
  const result = resolveImage("https://example.com/some-image.png");
  expect(result).toBe("/api/img?url=" + encodeURIComponent("https://example.com/some-image.png"));
});

test("resolveImage passes data:image/* URIs through unchanged", () => {
  const dataUri = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
  expect(resolveImage(dataUri)).toBe(dataUri);
});

test("resolveImage rejects javascript: URIs", () => {
  expect(resolveImage("javascript:alert(1)")).toBe("/placeholder.svg");
});

test("resolveImage rejects data:text/html URIs", () => {
  expect(resolveImage("data:text/html,<script>alert(1)</script>")).toBe("/placeholder.svg");
});

test("resolveImage rejects blob: URIs", () => {
  expect(resolveImage("blob:https://evil.example/abc")).toBe("/placeholder.svg");
});

test("resolveImage resolves ipfs:// URIs to Pinata's public gateway directly, no app-server hop", () => {
  expect(resolveImage("ipfs://QmXxx").startsWith("https://gateway.pinata.cloud/ipfs/QmXxx")).toBe(true);
});

test("a collection belongs to the wallet that owns it, whatever the padding", () => {
  const collection = { owner: "0x00c9c29971b48b8e485fbbf4f2d5f0bd2dfbf6a5369e08e2d9" };
  expect(isCollectionOwner(collection, "0xc9c29971b48b8e485fbbf4f2d5f0bd2dfbf6a5369e08e2d9")).toBe(true);
});

test("a different wallet does not own it", () => {
  expect(isCollectionOwner({ owner: "0x01" }, "0x02")).toBe(false);
});

test("an unknown owner or a disconnected wallet owns nothing", () => {
  expect(isCollectionOwner({ owner: null }, "0x01")).toBe(false);
  expect(isCollectionOwner({ owner: "0x01" }, null)).toBe(false);
  expect(isCollectionOwner(null, "0x01")).toBe(false);
  expect(isCollectionOwner(undefined, undefined)).toBe(false);
});
