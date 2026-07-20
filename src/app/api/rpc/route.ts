import { NextRequest, NextResponse } from "next/server";
import { isTransientRpcError } from "@medialane/sdk";
import { RPC_MAIN_URL, RPC_FALLBACK_URL } from "@/lib/constants";

/**
 * Server-side Starknet RPC proxy.
 *
 * Keeps the keyed RPC key OUT of the browser bundle. The dapp's client RPC
 * providers point at this same-origin route (/api/rpc); the keyed URL lives only
 * in the server-only MAIN var. MAIN stays the PRIMARY upstream; on a transient
 * failure (e.g. Alchemy's intermittent 503 / -32001) it rotates to the keyless
 * public FALLBACK (lava). Both come from `constants.ts` (single source).
 *
 * The dapp has no Clerk session to gate on (unlike io). Abuse protection:
 *  - same-origin guard: reject browser requests whose Origin is a different host
 *    (the realistic cross-origin abuse vector). Requests without an Origin
 *    (non-CORS / SSR) are allowed; the method allowlist + main cap + fallback
 *    bound the residual risk.
 *  - method allowlist: only forward the JSON-RPC methods the dapp actually uses
 *    (reads + addInvoke); trace/debug/declare/deploy-account are excluded.
 */

// Keyed MAIN first (primary), then the keyless public FALLBACK. Public providers
// are rate-limited, so rotation continues on transient JSON-RPC errors.
const RPC_URLS = Array.from(new Set(
  [RPC_MAIN_URL, RPC_FALLBACK_URL].filter((url): url is string => Boolean(url)),
));

// Allowlist of JSON-RPC methods forwarded upstream. Covers reads, approvals,
// tx lifecycle, fee estimation, and starknet.js internal handshake calls.
// Dangerous methods (trace, declare, deploy-account) are intentionally excluded.
const ALLOWED_METHODS = new Set([
  // ── Core read/write ───────────────────────────────────────────────────────
  "starknet_call",
  "starknet_addInvokeTransaction",
  // ── Transaction lifecycle ─────────────────────────────────────────────────
  "starknet_getTransactionReceipt",
  "starknet_getTransactionStatus",
  "starknet_getTransactionByHash",
  "starknet_getTransaction",
  "starknet_getBlockWithReceipts",
  // ── Fee estimation & nonce ────────────────────────────────────────────────
  "starknet_estimateFee",
  "starknet_getNonce",
  "starknet_simulateTransactions",
  // ── Provider initialisation (called automatically by starknet.js) ─────────
  "starknet_specVersion",
  "starknet_chainId",
  "starknet_blockNumber",
  "starknet_blockHashAndNumber",
  // ── Block queries ─────────────────────────────────────────────────────────
  "starknet_getBlockWithTxHashes",
  "starknet_getBlockWithTxs",
  // ── Contract / account introspection ─────────────────────────────────────
  "starknet_getClassAt",
  "starknet_getClass",
  "starknet_getClassHashAt",
  "starknet_getStorageAt",
  // ── Events ────────────────────────────────────────────────────────────────
  "starknet_getEvents",
]);

function isAllowedMethod(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.every((item) => isAllowedMethod(item));
  }
  if (body && typeof body === "object") {
    const method = (body as Record<string, unknown>).method;
    return typeof method === "string" && ALLOWED_METHODS.has(method);
  }
  return false;
}

/**
 * Same-origin guard. Blocks browser cross-origin abuse (which always carries an
 * Origin header) without breaking same-origin calls that omit it. Returns false
 * only when an Origin is present AND its host differs from the request host.
 */
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // no Origin (SSR / non-CORS) → allow
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * JSON-RPC error envelope. Always HTTP 200 so client-side starknet.js (which
 * crashes on `.json()` of a non-JSON body) can read a meaningful error.
 */
function rpcError(code: number, message: string, status = 200, id: number | null = null) {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code, message }, id },
    { status },
  );
}

// Per-IP rate limit. The same-origin guard only stops cross-origin *browsers*
// (a request with no Origin header is allowed), so a script can still use this
// as an open RPC relay and drain the keyed upstream's quota. Cap per-IP volume
// — generous enough for legit heavy use (a single tx fires ~20-40 calls incl.
// receipt polling), tight enough to bound abuse. Per-process (Vercel lambdas
// don't share memory); acceptable for cost-drain protection, not correctness.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 600;
const ipCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now >= entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return rpcError(-32600, "Cross-origin requests are not allowed", 403);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return rpcError(-32005, "Too many requests", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(-32700, "Parse error");
  }

  if (!isAllowedMethod(body)) {
    const method = !Array.isArray(body) && body && typeof body === "object"
      ? String((body as Record<string, unknown>).method ?? "<unknown>")
      : "<batch or invalid>";
    return rpcError(-32601, `Method not allowed: ${method}`);
  }

  let lastError = "No RPC upstream configured";

  for (const rpcUrl of RPC_URLS) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Read as text first so a non-JSON upstream (rate-limit HTML, Cloudflare
      // error page, empty body) doesn't crash `.json()`.
      const text = await response.text();
      const upstream = rpcUrl.split("/")[2];
      if (!text) {
        lastError = `Upstream RPC returned empty body (HTTP ${response.status})`;
        console.warn("[/api/rpc] upstream returned empty body", { status: response.status, upstream });
        continue;
      }

      try {
        const data = JSON.parse(text);

        // Transient JSON-RPC errors wrapped in a 200 envelope (rate limit /
        // capacity) → rotate to the next fallback. Deterministic contract errors
        // (revert, invalid params, missing block) propagate verbatim.
        if (isTransientRpcError({ status: response.status, body: data })) {
          const errObj = (data as { error?: { code?: unknown; message?: unknown } }).error;
          lastError = `Upstream RPC returned transient JSON-RPC error: ${String(errObj?.message ?? "(no message)")}`;
          console.warn("[/api/rpc] upstream returned transient JSON-RPC error", {
            upstream, code: errObj?.code, message: errObj?.message,
          });
          continue;
        }

        // Pass the JSON-RPC envelope through verbatim. Always HTTP 200.
        return NextResponse.json(data, { status: 200 });
      } catch {
        lastError = `Upstream RPC returned non-JSON (HTTP ${response.status})`;
        console.warn("[/api/rpc] upstream returned non-JSON", {
          status: response.status, upstream, bodyPreview: text.slice(0, 200),
        });
        continue;
      }
    } catch (err) {
      lastError = `Upstream RPC unreachable: ${err instanceof Error ? err.message : "unknown error"}`;
      console.warn("[/api/rpc] upstream fetch failed", {
        upstream: rpcUrl.split("/")[2],
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return rpcError(-32603, lastError);
}
