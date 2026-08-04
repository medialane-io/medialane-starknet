/**
 * Method/path allowlist for the /v1/* BFF proxy (route.ts). Pure logic,
 * split out so it's unit-testable without Next.js's route-export
 * restrictions (a route.ts file may only export recognized handlers).
 *
 * The proxy injects the server-only `MEDIALANE_API_KEY` into every outbound
 * request. The key is a fully-privileged tenant key — backend layered auth
 * (SIWS JWT, SNIP-12 signatures, on-chain ownership checks) handles the real
 * authorisation per route, but defense-in-depth at this boundary limits the
 * surface a leaked key or a future backend route addition can reach through
 * the dapp BFF.
 *
 * Scope rationale (mirrors medialane-io's allowlist; audit:
 * `medialane-core/docs/audits/2026-05-25-medialane-io-bff-proxy-auth-audit.md`):
 *   - GET requests on /v1/* are ALL allowed — reads are public-equivalent
 *     and the backend has no admin GET surface on /v1/ (admin lives at
 *     /admin/* on a separate API_SECRET_KEY gate). Per-resource GET
 *     enumeration is a known footgun — when a new SDK method appears
 *     without a matching pattern, otherwise-fine pages 403 in production.
 *   - /v1/intents/* is scoped as a NAMESPACE, not enumerated per intent
 *     type. Every intent-creation route (mint, create-collection,
 *     create-tier, listing, offer, cancel, fulfill, checkout,
 *     counter-offer, …) is dapp-legitimate by construction — this IS the
 *     metered write API every dapp write goes through as of the
 *     2026-08-04 backend-bypass fix (medialane-core audit
 *     `2026-08-04-medialane-starknet-backend-bypass-audit.md`), and each
 *     route is independently authorized server-side (SIWS/SNIP-12/on-chain
 *     ownership per intent type). Enumerating each verb here would
 *     silently 403 every new intent type until someone remembers a second,
 *     unrelated PR — which is exactly the outage this replaced.
 *   - Every other write is an EXPLICIT enumeration. Any new mutating route
 *     outside the intents namespace requires a corresponding entry and a
 *     dapp PR.
 *
 * When adding a new mutating endpoint to the dapp (outside /v1/intents/*),
 * add the (method, regex) pair below. Match against the path AFTER the
 * `/v1/` prefix.
 */
const ALLOWED_ROUTES: Record<string, RegExp[]> = {
  // ── Reads (all GET /v1/* allowed) ──────────────────────────────────────
  GET: [/.+/],
  // ── Mutations ────────────────────────────────────────────────────────
  POST: [
    /^intents\/[a-z-]+$/,                                  // POST /v1/intents/<type> — see namespace rationale above
    /^auth\/siws\/(nonce|verify)$/,                        // dapp SIWS sign-in
    /^collections\/(register|sync-tx|claim)$/,             // launchpad create + on-chain claim
    /^collections\/claim\/request$/,                       // manual-review claim request
    /^coins\/sync$/,                                       // creator coin launch → instant index
    /^collection-slug-claims$/,                            // collection settings slug claim
    /^drop\/conditions$/,                                  // launchpad drop/create
    /^remix-offers(\/(auto|self\/confirm|[^/]+\/(confirm|reject|extend)))?$/,  // remix offer lifecycle
    /^reports$/,                                           // /v1/reports
    /^users\/register$/,                                   // useRegisterUser
    /^username-claims$/,                                   // /v1/username-claims
  ],
  PATCH: [
    /^intents\/[^/]+\/(signature|confirm)$/,               // PATCH /v1/intents/:id/{signature,confirm} — sign/confirm lifecycle for any intent
    /^collections\/[^/]+\/profile$/,                       // updateCollectionProfile
    /^creators\/[^/]+\/profile$/,                          // updateCreatorProfile
    /^coins\/[^/]+$/,                                       // updateCoinProfile (creator-gated image/description)
  ],
  // DELETE intentionally empty — no dapp flow deletes through the proxy.
};

export function isPathAllowed(method: string, path: string): boolean {
  const patterns = ALLOWED_ROUTES[method.toUpperCase()];
  if (!patterns) return false;
  return patterns.some((re) => re.test(path));
}
