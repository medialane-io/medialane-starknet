import { test, expect } from "bun:test";
import { createRateLimiter } from "@/lib/rate-limit";

test("allows up to the configured max requests per IP within the window", () => {
  const check = createRateLimiter(60_000, 5);
  for (let i = 0; i < 5; i++) {
    expect(check("1.2.3.4")).toBe(true);
  }
  expect(check("1.2.3.4")).toBe(false);
});

test("tracks each IP independently", () => {
  const check = createRateLimiter(60_000, 1);
  expect(check("1.2.3.4")).toBe(true);
  expect(check("5.6.7.8")).toBe(true);
  expect(check("1.2.3.4")).toBe(false);
});
