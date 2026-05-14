# Connect-Wallet Panel Redesign + Privy Onboarding Collapse — Design

**Date:** 2026-05-14
**Status:** Approved (pending spec review)
**Motivation:** Privy onboarding now works end-to-end, but the connect panel still ships with three inconsistent button styles and the Privy onboarding code is a cross-context bridge that hid a one-week regression. Before pointing the seed-grant marketing push at this surface, we want a clean UI and a non-fragile internal architecture.

## Scope

This spec covers two related changes that touch adjacent files:

1. **UI:** Redesign the connect-wallet panel as a uniform 2×2 grid of wallet cards.
2. **Architecture:** Collapse `PrivyBridge` into `StarkZapWalletProvider` and remove the second context.

Out of scope: nav redesign, wallet-session status enum changes, backend signing endpoints, post-connect onboarding (username claim, welcome state).

---

## Part 1 — Connect-wallet panel

### Current state

Inside `src/components/nav-account-panel.tsx`, the disconnected-state branch (lines 77-128) renders:

- A "Connect wallet" header row with a wallet icon.
- A `connectors.map(...)` rendering Ready (Argent) and Braavos as full-width outlined buttons.
- A 2-column grid with Cartridge (ghost outline) and Privy (solid primary).

Three button styles in one panel. No visual hierarchy beyond Privy being purple.

### Target

A single 2×2 grid of identical cards. Hierarchy comes from a small `Recommended` pill on the Privy card — same card dimensions as the others.

#### Card anatomy (all four identical)

- Brand icon (h-5 w-5)
- Wallet name (text-sm, font-medium)
- `rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60` with a soft hover lift (`transition-colors`)
- Active connecting state: `ring-1 ring-primary/40` and a small spinner replacing the icon
- Disabled state during any in-flight connect: `opacity-60 cursor-not-allowed`

No subtitles. The card shows only the icon + name.

#### Card matrix

| Card | Icon (lucide) | Name |
|------|----------------|------|
| Privy | `Mail` | Email or social |
| Ready (Argent) | `Wallet` | Ready |
| Braavos | `Wallet` | Braavos |
| Cartridge | `Gamepad2` | Cartridge |

> Note: we keep using `Wallet` icons for Ready/Braavos for now. Brand SVGs can replace them later; the design doesn't depend on them.

#### Privy "Recommended" pill

A small chip in the top-right corner of the Privy card:

- `absolute top-2 right-2`
- `text-[10px] font-medium uppercase tracking-wider`
- `bg-primary/15 text-primary px-1.5 py-0.5 rounded-md`
- Text: "Recommended"

#### Panel chrome

- Remove the existing "Connect wallet" header (lines 79-86 of the current file). The grid is self-explanatory inside the nav menu.
- Keep the inline error row (currently lines 88-92) for injected-wallet failures, positioned **below** the grid (not above).
- The panel's outer container keeps `rounded-xl border border-border/40 bg-muted/20 p-3`.

#### Connected state

The connected-state branch (current lines 59-75) is unchanged.

### Files touched

- `src/components/nav-account-panel.tsx` — rewrite the disconnected-state branch only.

---

## Part 2 — Privy onboarding collapse

### Why

The current architecture has three pieces of Privy logic in two contexts:

1. `StarkZapWalletProvider` owns `pendingPrivyConnect` + session state, exposes a `StarkZapPrivyBridge` context with callbacks.
2. `PrivyBridge` consumes that bridge context plus `usePrivy()` and runs the connect flow.
3. `providers.tsx` lazy-loads both and threads a `PrivyBridgeMount` component into the tree.

This cross-context handshake is why the one-week regression went undetected: `PrivyBridge` rendered outside `StarkZapWalletProvider`, `useStarkZapPrivyBridge()` silently returned `undefined`, and every effect bailed at the first `if (!bridge?...)`.

### Target

One owner: `StarkZapWalletProvider`. The Privy connector becomes an internal sub-component rendered by the provider when `privyActive` is true. No second context.

#### New internal component: `PrivyConnector`

- Defined inside `src/contexts/starkzap-wallet-context.tsx` (not exported).
- Calls `usePrivy()` to read `{ ready, authenticated, login, logout, getAccessToken, user }`.
- Reads `pendingPrivyConnect` from the parent provider's state via closure (no second context — the provider passes refs/setters down via props).
- Runs the same connect flow we built earlier: gate on `ready`, call `login()` if not authenticated, hit `/api/wallet/starknet`, then `sdk.onboard({ deploy: "if_needed", feeMode: "sponsored" })`.
- Updates the parent's session state by calling functions passed as props.

#### Provider shape

```ts
function StarkZapWalletProvider({ children, onRequestPrivy }: Props) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [session, setSession] = useState<WalletSession>(IDLE_WALLET_SESSION);
  const [privyUser, setPrivyUser] = useState<User | null>(null);
  const [pendingPrivyConnect, setPendingPrivyConnect] = useState(false);

  const connectPrivy = useCallback(async () => {
    localStorage.setItem("ml_privy_session", "1");
    setSession(walletAuthenticating("privy"));
    onRequestPrivy();
    setPendingPrivyConnect(true);
  }, [onRequestPrivy]);

  // ... connectCartridge, disconnect ...

  // Error toast effect (unchanged)
  useEffect(() => { /* existing toast logic */ }, [session]);

  return (
    <StarkZapWalletContext.Provider value={{ ... }}>
      {/* Render the Privy connector only after providers.tsx has loaded
          the Privy SDK and mounted <PrivyProvider> above us. */}
      {PrivyConnectorMount ? (
        <PrivyConnector
          pendingConnect={pendingPrivyConnect}
          clearPending={() => setPendingPrivyConnect(false)}
          walletType={walletType}
          setSession={setSession}
          setWallet={setWallet}
          setPrivyUser={setPrivyUser}
        />
      ) : null}
      {children}
    </StarkZapWalletContext.Provider>
  );
}
```

`PrivyConnectorMount` is the dynamically-imported `PrivyConnector`. The provider takes it as a prop from `providers.tsx`, the same way it currently takes `onRequestPrivy`.

#### Files touched

- `src/contexts/starkzap-wallet-context.tsx` — absorb the connector logic; remove `StarkZapPrivyBridgeContext`, `useStarkZapPrivyBridge`, `StarkZapPrivyBridge` type.
- `src/contexts/privy-bridge.tsx` — **delete**. Its body becomes `PrivyConnector` inside the wallet context file (or its own file imported by it — see below).
- `src/app/providers.tsx` — pass the lazy-loaded `PrivyConnector` to the provider as a prop instead of mounting it as a sibling.
- `src/components/wallet/privy-connect-dialog.tsx` — unchanged. It reads from `useStarkZapWallet()` and that interface is stable.

#### File layout decision

Keep `PrivyConnector` in its own file: `src/contexts/privy-connector.tsx`. It still needs to be dynamically imported (it pulls in `usePrivy` and the StarkZap SDK), so a separate module makes the lazy boundary explicit. The difference vs. today is purely that it talks to its parent through plain prop callbacks, not a second context.

### Lazy-loading

Unchanged in behavior. `loadPrivyStack()` in `providers.tsx` still dynamically imports `@privy-io/react-auth` and the connector. The two changes:

1. `loadPrivyStack` now returns `{ PrivyWrapper, PrivyConnector }` for both to be passed into the provider.
2. The provider receives `privyConnector` as a prop and mounts it internally — no more `{PrivyBridgeMount ? <PrivyBridgeMount /> : null}` sibling in `providers.tsx`.

### Discriminated phase (deferred)

The original brainstorm proposed converting session state to a discriminated union (so `status: "error"` can't carry partial `address` data). On reflection that's a larger refactor that touches every consumer of `WalletSession`. **Defer to a follow-up spec.** This spec keeps the existing `WalletSession` type intact — the collapse alone removes the bug class we care about.

---

## Cross-cutting: user registration

Every wallet that connects on medialane-dapp is silently registered with the backend via `<UserRegistration />` (see memory: `arch-user-registry`, shipped 2026-05-12). This happens for injected wallets, Cartridge, and Privy by watching `useWallet()` and firing `POST /v1/users/register` with the correct `walletType`.

**This spec does not touch `<UserRegistration />` or `useWallet()`.** The collapse is internal to the Privy connect flow; once `setSession(walletReady("privy", addr))` is called, `useWallet()` exposes the address and registration fires as today. The refactor must preserve this — see Success criteria #4 and the verification step below.

## Success criteria

1. The disconnected-state nav panel shows a 2×2 grid of identically-styled wallet cards.
2. Privy card has a "Recommended" pill; no other visual difference.
3. Clicking any card runs the existing connect flow with no regressions.
4. The Privy connect flow (login → preparing → deploying → ready) still works end-to-end on mainnet, **and a fresh Privy address appears in the backend `users` table with `walletType=PRIVY` and `appSource=MEDIALANE_DAPP`** (proves `<UserRegistration />` still fires).
5. Auto-reconnect on reload still works.
6. `src/contexts/privy-bridge.tsx` no longer exists.
7. `StarkZapPrivyBridgeContext` and `useStarkZapPrivyBridge` are removed.
8. `npx tsc --noEmit` and `npm run lint` are clean.
9. `npm run build` succeeds.

## Verification

- Manual: open the dapp, verify the new grid, complete a Privy connect end-to-end (fresh email).
- Manual: confirm the backend `users` table has a row for the new Privy address with the correct `walletType` + `appSource` (via `GET /v1/users/me` with the SIWS token, or direct DB query).
- Manual: reload the page, verify auto-reconnect still works.
- Manual: try an injected wallet (Ready or Braavos) — the connecting state should show the ring + spinner inside that card, and registration should fire as before.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.
