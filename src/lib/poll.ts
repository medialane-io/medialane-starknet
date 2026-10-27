export async function pollUntil<T>(
  find: () => Promise<T | undefined>,
  { timeoutMs = 15_000, intervalMs = 2_000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const found = await find();
    if (found !== undefined) return found;
  }
  return undefined;
}
