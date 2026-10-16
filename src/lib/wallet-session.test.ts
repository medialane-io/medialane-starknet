import { describe, expect, test } from "bun:test";
import { nextSessionStep, sessionBelongsTo, signOut } from "./wallet-session";

const A = "0x0" + "a".repeat(63);
const B = "0x0" + "b".repeat(63);
const base = {
  status: "connected" as const,
  address: A,
  sessionWallet: null as string | null,
  sessionLoading: false,
  declined: [] as string[],
  signingIn: false,
};

describe("wallet session", () => {
  test("a connected wallet without a session signs in", () => {
    expect(nextSessionStep(base)).toBe("sign-in");
  });
  test("a connected wallet with its own session does nothing", () => {
    expect(nextSessionStep({ ...base, sessionWallet: "0x" + "a".repeat(63) })).toBe("none");
  });
  test("a session for a different wallet is signed out before signing in again", () => {
    expect(nextSessionStep({ ...base, sessionWallet: B })).toBe("sign-out");
    expect(nextSessionStep({ ...base, sessionWallet: null })).toBe("sign-in");
  });
  test("a session for a different wallet is signed out even when the new wallet declined", () => {
    expect(nextSessionStep({ ...base, sessionWallet: B, declined: [A] })).toBe("sign-out");
  });
  test("a session belongs only to its own wallet", () => {
    expect(sessionBelongsTo("0x" + "a".repeat(63), A)).toBe(true);
    expect(sessionBelongsTo(B, A)).toBe(false);
    expect(sessionBelongsTo(null, A)).toBe(false);
    expect(sessionBelongsTo(A, null)).toBe(false);
  });
  test("a disconnected status never signs out, because the wallet starts disconnected while it reconnects on page load", () => {
    expect(nextSessionStep({ ...base, status: "disconnected", address: null, sessionWallet: A })).toBe("none");
  });
  test("reconnecting neither signs in nor out", () => {
    expect(nextSessionStep({ ...base, status: "reconnecting", address: null, sessionWallet: A })).toBe("none");
    expect(nextSessionStep({ ...base, status: "connecting", address: null })).toBe("none");
  });
  test("nothing happens while the session is still loading or a sign-in is running", () => {
    expect(nextSessionStep({ ...base, sessionLoading: true })).toBe("none");
    expect(nextSessionStep({ ...base, signingIn: true })).toBe("none");
  });
  test("a declined signature is not asked again for that wallet", () => {
    expect(nextSessionStep({ ...base, declined: [A] })).toBe("none");
  });

  test("signing out clears the session on the app server", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    await signOut((async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method });
      return Response.json(null);
    }) as typeof fetch);
    expect(calls).toEqual([{ url: "/api/session", method: "DELETE" }]);
  });
});
