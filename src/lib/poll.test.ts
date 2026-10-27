import { expect, test } from "bun:test";
import { pollUntil } from "./poll";

test("returns the first value found", async () => {
  let calls = 0;
  const found = await pollUntil(async () => (++calls === 3 ? "hash" : undefined), { timeoutMs: 1000, intervalMs: 1 });
  expect(found).toBe("hash");
  expect(calls).toBe(3);
});

test("gives up with undefined after the timeout", async () => {
  const found = await pollUntil(async () => undefined, { timeoutMs: 20, intervalMs: 5 });
  expect(found).toBeUndefined();
});
