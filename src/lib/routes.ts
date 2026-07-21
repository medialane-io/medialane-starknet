// Chain-scoped URL routing helpers — single source is @medialane/sdk.
// Do not reimplement here; this file exists as the local import point so
// call sites read `from "@/lib/routes"` (mirrors medialane-io).
export { SUPPORTED_URL_CHAINS, chainSlug, chainFromSlug, assetHref, collectionHref, coinHref } from "@medialane/sdk";
