import { describe, expect, test } from "bun:test";
import { nextSessionStep } from "./wallet-session";

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
  test("disconnecting with a session signs out", () => {
    expect(nextSessionStep({ ...base, status: "disconnected", address: null, sessionWallet: A })).toBe("sign-out");
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
});
