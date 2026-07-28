"use client";

import * as React from "react";
import { useConnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { shortenAddress, useNavCommandMenu } from "@medialane/ui";
import { Loader2, LogOut, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useNetwork } from "@/components/starknet-provider";
import { useWallet } from "@/hooks/use-wallet";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { getConnectorDisplayName } from "@/lib/starknet-connectors";

export function NavAccountPanel() {
  const { connectors } = useConnect();
  const { address, isConnected, disconnect, isConnecting, connect } = useWallet();
  const { networkConfig } = useNetwork();
  const { close } = useNavCommandMenu();
  const [connectingId, setConnectingId] = React.useState<string | null>(null);

  // Auto-close once a connection actually completes — covers every wallet
  // type from one place instead of each connect handler guessing when it's
  // safe to close. Gated on a real false→true transition (not just "is
  // connected"): NavCommandMenu only renders accountSlot while open, so this
  // panel fully unmounts on close and remounts fresh on every open. Without
  // the transition guard, an already-connected wallet made every reopen call
  // close() the instant the panel mounted — the menu snapped shut before it
  // could ever be seen again once a wallet was connected.
  const wasConnectedRef = React.useRef(isConnected);
  React.useEffect(() => {
    if (isConnected && !wasConnectedRef.current) close();
    wasConnectedRef.current = isConnected;
  }, [isConnected, close]);

  const connectInjected = async (connector: Connector) => {
    setConnectingId(connector.id);
    try {
      await connect(connector);
    } catch (err) {
      console.error("[nav-account-panel] connect error:", err);
      const friendly = getFriendlyWalletError(err);
      if (friendly.isUserRejection) {
        toast.info("Wallet didn't connect", { description: "You may have declined it, or your wallet may need extra verification first." });
      } else {
        toast.error("Wallet connection failed", { description: friendly.message });
      }
    } finally {
      setConnectingId(null);
    }
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background/70 text-muted-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
        <span className="truncate text-sm font-medium text-foreground">{shortenAddress(address)}</span>
        <button
          onClick={() => { disconnect(); close(); }}
          className="ml-auto shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Disconnect wallet"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  type CardOption = {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    isLoading: boolean;
  };

  const argent = connectors.find((c) => c.id === "argentX");
  const braavos = connectors.find((c) => c.id === "braavos");

  const cards: CardOption[] = [
    {
      key: "argent",
      label: argent ? getConnectorDisplayName(argent.id, argent.name) : "Ready",
      icon: <Wallet className="h-5 w-5" />,
      onClick: () => argent && void connectInjected(argent),
      isLoading: connectingId === "argentX",
    },
    {
      key: "braavos",
      label: braavos ? getConnectorDisplayName(braavos.id, braavos.name) : "Braavos",
      icon: <Wallet className="h-5 w-5" />,
      onClick: () => braavos && void connectInjected(braavos),
      isLoading: connectingId === "braavos",
    },
  ];

  const anyBusy = isConnecting || connectingId !== null;

  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            disabled={anyBusy && !card.isLoading}
            className={`relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-border/50 bg-muted/30 px-3 text-xs font-medium transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60 ${
              card.isLoading ? "ring-1 ring-primary/40" : ""
            }`}
          >
            <span className="text-foreground/80">
              {card.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : card.icon}
            </span>
            <span className="text-foreground">{card.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
