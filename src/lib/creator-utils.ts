
export function addressPalette(address: string) {
  const seed = parseInt(address.slice(2, 10) || "a1b2c3d4", 16);
  const h1 = seed % 360;
  const h2 = (h1 + 137) % 360;
  const h3 = (h1 + 73) % 360;
  return { h1, h2, h3 };
}
