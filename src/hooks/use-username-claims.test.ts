import { describe, expect, test, mock, afterEach } from "bun:test";
import { checkUsernameAvailability, submitUsernameClaim } from "./use-username-claims";

const original = globalThis.fetch;

describe("use-username-claims goes through the SDK client", () => {
  afterEach(() => {
    globalThis.fetch = original;
  });

  test("checkUsernameAvailability asks the username-claims check route", async () => {
    const fetchMock = mock(async (url: string) => {
      expect(new URL(url).pathname.endsWith("/v1/username-claims/check/alice")).toBe(true);
      return new Response(JSON.stringify({ available: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await checkUsernameAvailability("alice")).toEqual({ available: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("submitUsernameClaim posts the claim with the caller's sign-in token", async () => {
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      expect(new URL(url).pathname.endsWith("/v1/username-claims")).toBe(true);
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer siws-token-123");
      return new Response(JSON.stringify({ claim: { id: "1", username: "alice" } }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await submitUsernameClaim("alice", "siws-token-123");
    expect(result.claim?.id).toBe("1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("submitUsernameClaim without a sign-in token sends nothing", async () => {
    const fetchMock = mock(async () => new Response("{}"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect((await submitUsernameClaim("alice", null)).error).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
