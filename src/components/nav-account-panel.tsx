"use client";

import * as React from "react";
import { useConnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { shortenAddress, useNavCommandMenu } from "@medialane/ui";
import { Gamepad2, Loader2, LogOut, Mail, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/wallet";


function getConnectorDisplayName(id: string, fallback: string) {
  const names: Record<string, string> = {
    argentX: "Ready",
    braavos: "Braavos",
    webwallet: "Argent Web Wallet",
  };
  return names[id] ?? fallback;
}


export function NavAccountPanel() {
  const { connectors } = useConnect();
  const { address, isConnected, isConnecting, error, disconnect, connect } = useWallet();
  const { close } = useNavCommandMenu();
  const [connectingId, setConnectingId] = React.useState<string | null>(null);

  const connectInjected = async (connector: Connector) => {
    setConnectingId(connector.id);
    try {
      await connect(connector.id.toLowerCase() === "braavos" ? "braavos" : "argent");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet connection failed";
      if (/user rejected|user aborted|aborted|rejected/i.test(message)) {
        toast.info("Wallet connection cancelled");
      } else {
        toast.error("Wallet connection failed", { description: message });
      }
    } finally {
      setConnectingId(null);
    }
  };

  const connectStarkZap = async (type: "cartridge" | "privy") => {
    close();
    try {
      await connect(type);
    } catch {
      // The wallet store exposes the user-facing error state.
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
      key: "privy",
      label: "Email or social",
      icon: <Mail className="h-5 w-5" />,
      onClick: () => void connectStarkZap("privy"),
      isLoading: isConnecting && !connectingId,
    },
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
    {
      key: "cartridge",
      label: "Cartridge",
      icon: <Gamepad2 className="h-5 w-5" />,
      onClick: () => void connectStarkZap("cartridge"),
      isLoading: false,
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

      {error && (
        <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
