
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
