import { test, expect } from "bun:test";
import { getFriendlyWalletError, isBareExecuteFailure, isUserRejectedRequest } from "./wallet-error";

test("isBareExecuteFailure matches Braavos's bare 'Execute failed' exactly", () => {
  expect(isBareExecuteFailure(new Error("Execute failed"))).toBe(true);
  expect(isBareExecuteFailure(new Error("execute failed"))).toBe(true);
  expect(isBareExecuteFailure(new Error("  Execute failed  "))).toBe(true);
});

test("isBareExecuteFailure does not match an on-chain revert with a reason", () => {
  expect(isBareExecuteFailure(new Error("Execute failed: revert reason foo"))).toBe(false);
});

test("a bare 'Execute failed' gets accurate copy naming all three real causes, not just user decline", () => {
  // Regression for 2026-08-04: this exact message was produced by a transient
  // Braavos estimateFee RPC hiccup with zero user action — a retry with no
  // code change succeeded immediately after. The old copy asserted "you may
  // have closed or declined it" as if that were the only real possibility.
  const friendly = getFriendlyWalletError(new Error("Execute failed"));
  expect(friendly.isUserRejection).toBe(true);
  expect(friendly.description).toContain("temporary network hiccup");
  expect(friendly.description).toContain("2FA");
});

test("an explicit rejection phrase still gets the original decline-focused copy", () => {
  const friendly = getFriendlyWalletError(new Error("User rejected the request"));
  expect(friendly.isUserRejection).toBe(true);
  expect(friendly.description).toContain("you may have closed or declined it");
  expect(friendly.description).not.toContain("temporary network hiccup");
});

test("isUserRejectedRequest still returns true for a bare execute failure (unchanged boolean semantics)", () => {
  expect(isUserRejectedRequest(new Error("Execute failed"))).toBe(true);
});
