
const ALLOWED_ROUTES: Record<string, RegExp[]> = {

  // Explicit allowlist — every path here is a public/self-scoped read the dapp
  // actually calls through @medialane/sdk, @medialane/ui's shared hooks, or its
  // own hooks. Anything not listed (e.g. /v1/portal/*, /v1/business/provisioning)
  // is internal/self-service tenant data and must stay unreachable from this
  // public proxy.
  GET: [
    /^orders$/,
    /^orders\/[^/]+$/,
    /^orders\/token\/[^/]+\/[^/]+$/,
    /^orders\/user\/[^/]+$/,
    /^orders\/received\/[^/]+$/,
    /^orders\/counter-offers$/,
    /^tokens$/,
    /^tokens\/owned\/[^/]+$/,
    /^tokens\/[^/]+\/[^/]+$/,
    /^tokens\/[^/]+\/[^/]+\/(history|comments|remixes)$/,
    /^collections$/,
    /^collections\/[^/]+$/,
    /^collections\/[^/]+\/tokens$/,
    /^collections\/[^/]+\/gated-content$/,
    /^collections\/[^/]+\/profile$/,
    /^activities$/,
    /^activities\/[^/]+$/,
    /^search$/,
    /^intents\/[^/]+$/,
    /^creators$/,
    /^creators\/[^/]+\/profile$/,
    /^creators\/by-username\/[^/]+$/,
    /^collection-slug-claims\/check\/[^/]+$/,
    /^collection-slug-claims\/me$/,
    /^pop\/eligibility\/[^/]+(\/[^/]+)?$/,
    /^coins$/,
    /^coins\/prices$/,
    /^coins\/[^/]+$/,
    /^drop\/mint-status\/[^/]+\/[^/]+$/,
    /^drop\/[^/]+\/(info|state)$/,
    /^rewards$/,
    /^rewards\/config$/,
    /^rewards\/batch$/,
    /^rewards\/[^/]+$/,
    /^rewards\/[^/]+\/events$/,
    /^club\/[^/]+\/[^/]+$/,
    /^club\/[^/]+\/[^/]+\/member\/[^/]+$/,
    /^tickets\/[^/]+\/[^/]+$/,
    /^tickets\/[^/]+\/count$/,
    /^username-claims\/me$/,
    /^username-claims\/check\/[^/]+$/,
    /^stats$/,
    /^prices$/,
    /^remix-offers$/,
    /^remix-offers\/[^/]+$/,
    /^sponsorship\/offers$/,
    /^sponsorship\/offers\/[^/]+$/,
    /^sponsorship\/offers\/[^/]+\/bids$/,
    /^sponsorship\/proposals$/,
    /^sponsorship\/proposals\/[^/]+$/,
    /^sponsorship\/licenses$/,
    /^sponsorship\/licenses\/[^/]+$/,
  ],

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
