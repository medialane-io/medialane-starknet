"use client";

/**
 * TEMPORARY verification page for the new wallet layer (feat/wallet-connection-redesign).
 * Exercises useWallet() in isolation — the new store/adapters — WITHOUT touching any
 * live consumer. Delete this route before the Phase 3 cutover lands.
 */

import { useEffect, useState } from "react";
import { WalletProvider, useWallet, type WalletMethod } from "@/wallet";

const METHODS: WalletMethod[] = ["argent", "braavos", "cartridge", "privy"];

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-foreground">{v}</span>
    </div>
  );
}

function Debug() {
  const w = useWallet();
  const [lastChoice, setLastChoice] = useState<string>("—");

  useEffect(() => {
    const t = setInterval(() => {
      setLastChoice(
        typeof window === "undefined" ? "—" : localStorage.getItem("ml_wallet") ?? "(none)",
      );
    }, 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <h1 className="text-xl font-bold">Wallet layer — debug</h1>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <Row k="status" v={w.status} />
        <Row k="isConnected" v={String(w.isConnected)} />
        <Row k="isConnecting" v={String(w.isConnecting)} />
        <Row k="method" v={w.method ?? "—"} />
        <Row k="address" v={w.address ? `${w.address.slice(0, 10)}…${w.address.slice(-6)}` : "—"} />
        <Row k="error" v={w.error ?? "—"} />
        <Row k="persisted ml_wallet" v={lastChoice} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => w.connect(m).catch((e) => console.error(e))}
            disabled={w.isConnecting}
            className="rounded-lg border border-border/60 bg-background/60 px-4 py-2.5 text-sm font-semibold capitalize transition-colors hover:bg-muted/40 disabled:opacity-50"
          >
            Connect {m}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => w.disconnect()}
        className="w-full rounded-lg border border-destructive/50 px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        Disconnect
      </button>

      <p className="text-xs text-muted-foreground">
        Verify: connect an injected wallet → reload (stays connected); with it active, navigate to
        /mint and back (Privy must NOT take over); connect Privy on /airdrop (deploys → ready);
        reload /airdrop (silent reconnect). Then disconnect.
      </p>
    </div>
  );
}

export default function WalletDebugPage() {
  return (
    <WalletProvider>
      <Debug />
    </WalletProvider>
  );
}
