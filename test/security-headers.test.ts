import { expect, test } from "bun:test";
import nextConfig from "../next.config";

test("every page tells browsers to use HTTPS only", async () => {
  const rules = await nextConfig.headers!();
  const everyPage = rules.find(({ source }) => source === "/:path*");
  expect(everyPage?.headers).toContainEqual({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
});
