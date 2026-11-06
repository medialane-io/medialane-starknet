import { expect, test } from "bun:test";
import { writePhase } from "./write-phase";

test("nothing started is idle", () => {
  expect(writePhase({ isProcessing: false, txHash: null, error: null })).toBe("idle");
});

test("work in progress is busy whatever else is set", () => {
  expect(writePhase({ isProcessing: true, txHash: null, error: null })).toBe("submitting");
  expect(writePhase({ isProcessing: true, txHash: "0x1", error: "old" })).toBe("submitting");
});

test("a transaction with no error is success", () => {
  expect(writePhase({ isProcessing: false, txHash: "0x1", error: null })).toBe("success");
});

test("an error is an error, with or without a transaction", () => {
  expect(writePhase({ isProcessing: false, txHash: null, error: "closed" })).toBe("error");
  expect(writePhase({ isProcessing: false, txHash: "0x1", error: "reverted" })).toBe("error");
});
