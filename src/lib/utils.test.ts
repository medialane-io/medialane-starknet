import { test, expect } from "bun:test";
import { ipfsToHttp } from "./utils";

test("ipfsToHttp routes https URLs through the image proxy", () => {
  const result = ipfsToHttp("https://gateway.pinata.cloud/ipfs/abc123");
  expect(result).toBe("/api/img?url=" + encodeURIComponent("https://gateway.pinata.cloud/ipfs/abc123"));
});

test("ipfsToHttp passes data:image/* URIs through unchanged", () => {
  const dataUri = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
  expect(ipfsToHttp(dataUri)).toBe(dataUri);
});

test("ipfsToHttp rejects javascript: URIs", () => {
  expect(ipfsToHttp("javascript:alert(1)")).toBe("/placeholder.svg");
});

test("ipfsToHttp rejects data:text/html URIs", () => {
  expect(ipfsToHttp("data:text/html,<script>alert(1)</script>")).toBe("/placeholder.svg");
});

test("ipfsToHttp rejects blob: URIs", () => {
  expect(ipfsToHttp("blob:https://evil.example/abc")).toBe("/placeholder.svg");
});

test("ipfsToHttp still proxies ipfs:// URIs through /api/ipfs", () => {
  expect(ipfsToHttp("ipfs://QmXxx")).toBe("/api/ipfs/QmXxx");
});
