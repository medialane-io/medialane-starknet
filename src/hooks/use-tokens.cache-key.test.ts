import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(import.meta.dir, "use-tokens.ts"), "utf8");

interface CallSite {
  hook: string;
  key: string;
  fetcher: string;
}

function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  const pattern =
    /export function (\w+)\([^)]*\)[\s\S]*?useSWR\(\s*([\s\S]*?),\s*\n\s*\(\)\s*=>\s*([^\n]*)/g;

  for (const [, hook, key, fetcher] of SOURCE.matchAll(pattern)) {
    sites.push({ hook: hook!, key: key!, fetcher: fetcher! });
  }
  return sites;
}

function fetcherArguments(fetcher: string): string[] {
  const args = fetcher.match(/\(([^)]*)\)\s*$/)?.[1] ?? fetcher.match(/\(([^)]*)\)/)?.[1] ?? "";
  return args
    .split(",")
    .map((a) => a.trim().replace(/!$/, ""))
    .filter((a) => /^[a-z][A-Za-z0-9]*$/.test(a));
}

describe("SWR keys name every argument that changes the response", () => {
  test("the hooks in this file are actually being scanned", () => {
    const sites = callSites();
    expect(sites.map((s) => s.hook)).toContain("useTokensByOwner");

    const owner = sites.find((s) => s.hook === "useTokensByOwner")!;
    expect(fetcherArguments(owner.fetcher).sort()).toEqual(["address", "limit", "page"]);
  });

  test("no hook fetches with an argument its cache key ignores", () => {
    const offenders: string[] = [];

    for (const site of callSites()) {
      for (const arg of fetcherArguments(site.fetcher)) {
        if (!new RegExp(`\\$\\{${arg}\\b`).test(site.key)) {
          offenders.push(`${site.hook}: fetches with "${arg}" but the key omits it`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
