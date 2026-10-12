import { describe, expect, test } from "bun:test";
import { declinedWallets, nextSessionStep, rememberDeclined, signOut } from "./wallet-session";

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
  test("a different wallet signs in again", () => {
    expect(nextSessionStep({ ...base, sessionWallet: B })).toBe("sign-in");
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

  test("a declined wallet is remembered for the tab, so a reload does not ask again", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(declinedWallets(storage)).toEqual([]);
    rememberDeclined(storage, A);
    rememberDeclined(storage, A);
    expect(declinedWallets(storage)).toEqual([A]);
  });

  test("storage that throws or is missing never breaks sign-in", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(declinedWallets(broken)).toEqual([]);
    expect(() => rememberDeclined(broken, A)).not.toThrow();
    expect(declinedWallets(null)).toEqual([]);
  });
});
