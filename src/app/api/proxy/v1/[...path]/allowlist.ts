
const ALLOWED_ROUTES: Record<string, RegExp[]> = {

  GET: [/.+/],

  POST: [
    /^intents\/[a-z-]+$/,
    /^auth\/siws\/(nonce|verify)$/,
    /^collections\/(register|sync-tx|claim)$/,
    /^collections\/claim\/request$/,
    /^coins\/sync$/,
    /^collection-slug-claims$/,
    /^drop\/conditions$/,
    /^remix-offers(\/(auto|self\/confirm|[^/]+\/(confirm|reject|extend)))?$/,
    /^users\/register$/,
    /^username-claims$/,
  ],
  PATCH: [
    /^intents\/[^/]+\/(signature|confirm)$/,
    /^collections\/[^/]+\/profile$/,
    /^creators\/[^/]+\/profile$/,
    /^coins\/[^/]+$/,
  ],

};

export function isPathAllowed(method: string, path: string): boolean {
  const patterns = ALLOWED_ROUTES[method.toUpperCase()];
  if (!patterns) return false;
  return patterns.some((re) => re.test(path));
}

export function hasTraversalSegment(joinedPath: string): boolean {
  return joinedPath.split("/").some((piece) => piece === "." || piece === "..");
}
