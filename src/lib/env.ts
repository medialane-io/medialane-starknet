type HexAddress = `0x${string}`;

function isHexAddress(value: string): value is HexAddress {
  return /^0x[0-9a-fA-F]{1,64}$/.test(value);
}

export function readOptionalAddressEnv(value: string | undefined, name: string): HexAddress | "" {
  if (!value) return "";
  if (!isHexAddress(value)) {
    throw new Error(`Invalid ${name}: expected a Starknet hex address starting with 0x`);
  }
  return value;
}

export function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function readUrlEnv(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (isHttpUrl(candidate)) return candidate;
  }
  return "";
}
