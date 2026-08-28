import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// An SWR key identifies a cached response, so it has to name every argument
// that changes what the response contains. When it does not, two components
// asking the same question with different arguments share one entry and
// whichever fetches first decides what the other one sees.
//
// That is not hypothetical here: the account panel reads an address with
// limit 1 to show a count, while the portfolio grid reads the same address
// with limit 20 to render them. The key omitted limit, so the two views
// disagreed about how many assets the account had.
//
// This compares each key against its own fetcher rather than testing one key,
// because the failure is silent — nothing throws, a view quietly shows the
// wrong data.
const SOURCE = readFileSync(join(import.meta.dir, "use-tokens.ts"), "utf8");

interface CallSite {
  hook: string;
  key: string;
  fetcher: string;
}

/** Pairs each useSWR key expression with the fetcher call directly beneath it. */
function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  const pattern =
    /export function (\w+)\([^)]*\)[\s\S]*?useSWR\(\s*([\s\S]*?),\s*\n\s*\(\)\s*=>\s*([^\n]*)/g;

  for (const [, hook, key, fetcher] of SOURCE.matchAll(pattern)) {
    sites.push({ hook: hook!, key: key!, fetcher: fetcher! });
  }
  return sites;
}

/** Identifiers passed as arguments in a fetcher call, ignoring the client path. */
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
