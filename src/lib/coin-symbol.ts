
export function suggestCoinSymbol(name: string, maxLength = 10): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim();
  if (!cleaned) return "";

  const words = cleaned.split(/\s+/).filter(Boolean);
  const initials = words
    .filter((word) => /[A-Z0-9]/.test(word))
    .map((word) => word[0])
    .join("");
  const digits = words.join("").replace(/[^0-9]/g, "");

  let candidate = `${initials}${digits}`.slice(0, maxLength);
  if (candidate.length < 3) {
    candidate = words.join("").replace(/\s+/g, "").slice(0, maxLength);
  }

  return candidate.slice(0, maxLength);
}
