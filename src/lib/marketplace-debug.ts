

interface Breadcrumb {
  t: number;
  label: string;
  data?: unknown;
}

let log: Breadcrumb[] = [];

export function resetMarketplaceDebug(op: string) {
  log = [{ t: Date.now(), label: `${op}: start` }];
}

export function markMarketplaceDebug(label: string, data?: unknown) {
  log.push({ t: Date.now(), label, data });

  console.log(`[marketplace-debug] ${label}`, data ?? "");
}

export function getMarketplaceDebugText(extra?: { error?: unknown }): string {
  const t0 = log[0]?.t ?? Date.now();
  const lines = log.map((b) => `+${b.t - t0}ms  ${b.label}${b.data !== undefined ? "  " + safeStringify(b.data) : ""}`);
  if (extra?.error !== undefined) {
    lines.push("", "error:", safeStringify(errorDetail(extra.error)));
  }
  lines.push("", `ua: ${typeof navigator !== "undefined" ? navigator.userAgent : "n/a"}`);
  return lines.join("\n");
}

function errorDetail(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2);
  } catch {
    return String(v);
  }
}
