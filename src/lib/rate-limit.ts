/**
 * Per-IP, per-process rate limiter for API routes. Not shared across Vercel
 * lambdas (no shared memory) — that's fine for cost-drain / abuse-bounding
 * protection, not for correctness guarantees.
 *
 * Each call site should hold its own limiter instance (own window/max, own
 * counter map) rather than sharing one across unrelated routes.
 */
export function createRateLimiter(windowMs: number, max: number) {
  const counts = new Map<string, { count: number; resetAt: number }>();

  return function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = counts.get(ip);
    if (!entry || now >= entry.resetAt) {
      counts.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count += 1;
    return true;
  };
}
