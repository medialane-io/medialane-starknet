export function readStored(storage: "localStorage" | "sessionStorage", key: string): string | null {
  try {
    return window[storage].getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(storage: "localStorage" | "sessionStorage", key: string, value: string): void {
  try {
    window[storage].setItem(key, value);
  } catch {}
}
