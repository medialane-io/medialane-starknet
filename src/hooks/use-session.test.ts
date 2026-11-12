import { afterEach, describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { useSession } from "./use-session";

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

describe("useSession", () => {
  test("focus and reconnect do not ask the server again", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(input.toString());
      return new Response(JSON.stringify({ accountId: "a1", walletAddress: "0x1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0, focusThrottleInterval: 0 } }, children);
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session).not.toBeNull());
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(calls).toEqual(["/api/session"]);
  });
});
