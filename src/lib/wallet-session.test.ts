import { expect, test } from "bun:test";
import { signOut } from "./wallet-session";

test("signing out clears the session on the app server", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  await signOut((async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method });
    return Response.json(null);
  }) as typeof fetch);
  expect(calls).toEqual([{ url: "/api/session", method: "DELETE" }]);
});
