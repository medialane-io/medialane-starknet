import { test, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = import.meta.dir;
const EXECUTION_PRIMITIVES = new Set(["lib/use-venue-signer.ts", "hooks/use-tx.ts", "hooks/use-wallet.ts", "contexts/wallet-context.tsx"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(entry) || entry.includes(".test.")) return [];
    return [full];
  });
}

test("wallet transactions carry backend intent ids and no fee call is built in the browser", () => {
  const offenders = sourceFiles(SRC).flatMap((file) => {
    const rel = file.slice(SRC.length + 1);
    const source = readFileSync(file, "utf8");
    const found: string[] = [];
    if (source.includes("buildFeeCall")) found.push(`${rel}: buildFeeCall`);
    if (EXECUTION_PRIMITIVES.has(rel)) return found;
    source.split("\n").forEach((line, i) => {
      if (/\b(execute|executeTransaction)\(/.test(line) && !/intentIds|function execute|const execute|executeIntent|executeWith|executeSponsored/.test(line)) {
        found.push(`${rel}:${i + 1}: execute without intent ids`);
      }
    });
    return found;
  });
  expect(offenders).toEqual([]);
});
