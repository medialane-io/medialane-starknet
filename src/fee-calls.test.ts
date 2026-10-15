import { test, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = import.meta.dir;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(entry) || entry.includes(".test.")) return [];
    return [full];
  });
}

test("no fee call is built in the browser", () => {
  const offenders = sourceFiles(SRC).flatMap((file) => {
    const rel = file.slice(SRC.length + 1);
    const source = readFileSync(file, "utf8");
    const found: string[] = [];
    if (source.includes("buildFeeCall")) found.push(`${rel}: buildFeeCall`);
    if (source.includes("NEXT_PUBLIC_FEE_")) found.push(`${rel}: app fee settings`);
    return found;
  });
  expect(offenders).toEqual([]);
});
