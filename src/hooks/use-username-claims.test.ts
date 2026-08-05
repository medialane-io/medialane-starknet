import { describe, expect, test, mock, afterEach } from "bun:test";
import { checkUsernameAvailability, submitUsernameClaim } from "./use-username-claims";

describe("use-username-claims — routes through /api/proxy, never the backend origin", () => {
  afterEach(() => {
    (globalThis.fetch as any).mockRestore?.();
  });

  test("checkUsernameAvailability calls /api/proxy/v1/username-claims/check/:username", async () => {
    const fetchMock = mock(async (url: string) => {
      expect(url).toBe("/api/proxy/v1/username-claims/check/alice");
      expect(url).not.toContain("http");
      return new Response(JSON.stringify({ available: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await checkUsernameAvailability("alice");
    expect(result).toEqual({ available: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("submitUsernameClaim POSTs to /api/proxy/v1/username-claims", async () => {
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/proxy/v1/username-claims");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBeUndefined();
      return new Response(JSON.stringify({ claim: { id: "1", username: "alice" } }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await submitUsernameClaim("alice", "siws-token-123");
    expect(result.claim).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
