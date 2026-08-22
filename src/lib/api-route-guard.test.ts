import { test, expect } from "bun:test";
import { isSameOrigin } from "@/lib/api-route-guard";
import type { NextRequest } from "next/server";

function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

test("allows a request with no origin header", () => {
  expect(isSameOrigin(req({ host: "starknet.medialane.io" }))).toBe(true);
});

test("allows an origin whose host matches the host header", () => {
  expect(
    isSameOrigin(req({ origin: "https://starknet.medialane.io", host: "starknet.medialane.io" })),
  ).toBe(true);
});

test("rejects an origin from a different host", () => {
  expect(
    isSameOrigin(req({ origin: "https://evil.example", host: "starknet.medialane.io" })),
  ).toBe(false);
});

test("rejects an unparseable origin", () => {
  expect(isSameOrigin(req({ origin: "not-a-url", host: "starknet.medialane.io" }))).toBe(false);
});
