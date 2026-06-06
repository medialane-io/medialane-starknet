"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useConnect, useAccount, useDisconnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wallet,
  LogOut,
  User,
  History,
  Settings,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Copy,
  Layers,
  BarChart3,
  PlusCircle,
  Box,
  Rocket,
  ArrowRightLeft,
  Gamepad2,
  Loader2,
  AlertCircle,
  Mail,
} from "lucide-react";
import { useNetwork } from "@/components/starknet-provider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useWalletSession } from "@/hooks/use-wallet-session";
import { useWallet } from "@/wallet";
import type { WalletSessionType } from "@/lib/wallet-session";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type ConnectorIconObj = { dark?: string; light?: string };

function getConnectorIconSrc(icon: ConnectorIconObj | string | undefined): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;
  return icon.dark ?? icon.light;
}

function getConnectorDisplayName(id: string, fallback: string): string {
  const NAMES: Record<string, string> = {
    argentX: "Ready",
    braavos: "Braavos",
    webwallet: "Argent Web Wallet",
  };
  return NAMES[id] ?? fallback;
}

type WalletBadgeInfo = {
  label: string;
  icon: React.ReactNode;
  className: string;
  hint?: string;
};

function getWalletBadge(
  walletType: WalletSessionType | null
): WalletBadgeInfo | null {
  if (walletType === "cartridge") {
    return {
      label: "Cartridge",
      icon: <Gamepad2 className="h-3 w-3" />,
      className: "border-purple-500/30 text-purple-400 bg-purple-500/5",
      hint: "Auto-gasless",
    };
  }
  if (walletType === "privy") {
    return {
      label: "Social Login",
      icon: <Mail className="h-3 w-3" />,
      className: "border-blue-500/30 text-blue-400 bg-blue-500/5",
      hint: "Gasless",
    };
  }
  // argent / braavos are injected browser wallets — same badge as a generic
  // injected connection. (Argent rebranded to "Ready"; "argent" here is the
  // technical wallet-type id, not a user-facing label — the label stays generic.)
  if (
    walletType === "injected" ||
    walletType === "argent" ||
    walletType === "braavos"
  ) {
    return {
      label: "Browser Wallet",
      icon: <Wallet className="h-3 w-3" />,
      className: "border-emerald-500/20 text-emerald-400 bg-emerald-500/5",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ConnectWalletProps {
  label?: string;
  className?: string;
}

export function ConnectWallet({ label, className }: ConnectWalletProps = {}) {
  const { connectAsync, connectors } = useConnect();
  const { isConnected: injectedConnected, chainId } = useAccount();
  const { disconnect: injectedDisconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [injectedConnectingId, setInjectedConnectingId] = useState<string | null>(null);
  const { networkConfig } = useNetwork();
  const {
    address,
    isConnected,
    isConnecting: sessionConnecting,
    walletType: activeWalletType,
    error: sessionError,
  } = useWalletSession();

  const { privyUser } = useStarkZapWallet();
  const { connect: walletConnect, disconnect: walletDisconnect } = useWallet();

  // ---------------------------------------------------------------------------
  // Unified state
  // ---------------------------------------------------------------------------

  const hasStarkZap = activeWalletType === "cartridge" || activeWalletType === "privy";

  const isWrongNetwork =
    injectedConnected &&
    !hasStarkZap &&
    chainId &&
    BigInt(chainId).toString() !== networkConfig.chainId;

  const badge = getWalletBadge(activeWalletType);

  // Auto-close connect dialog when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      setConnectDialogOpen(false);
    }
  }, [isConnected, address]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleConnectorClick = async (connector: Connector) => {
    // Close our dialog first so the wallet extension popup is unobstructed
    setConnectDialogOpen(false);
    setInjectedConnectingId(connector.id);
    try {
      // Explicit choice → the new wallet store sets this the single active wallet
      // and persists it; any prior Privy/Cartridge session is retired automatically
      // (single-active-wallet model — no manual szDisconnect / ml_privy_session).
      await walletConnect(connector.id?.toLowerCase() === "braavos" ? "braavos" : "argent");
    } catch (err) {
      console.error("Failed to connect wallet", err);
      const message = err instanceof Error ? err.message : "Wallet connection failed";
      if (/user rejected|user aborted|aborted|rejected/i.test(message)) {
        toast.info("Wallet connection cancelled");
      } else {
        toast.error("Wallet connection failed", { description: message });
      }
      setConnectDialogOpen(true);
    } finally {
      setInjectedConnectingId(null);
    }
  };

  const handleCartridgeConnect = async () => {
    setConnectDialogOpen(false);
    try {
      await walletConnect("cartridge");
    } catch {
      // error surfaced via session state
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Address copied");
    }
  };

  const handleDisconnect = () => {
    walletDisconnect();
    setOpen(false);
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (sessionConnecting && !isConnected) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-8 w-8"
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  // ---------------------------------------------------------------------------
  // Connected state — Sheet with portfolio/creator links
  // ---------------------------------------------------------------------------

  if (isConnected && address) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`relative rounded-full h-8 w-8 transition-all duration-300 hover:bg-foreground/10 dark:hover:bg-foreground/10
              ${isWrongNetwork
                ? "bg-red-500/10 text-red-500"
                : "text-foreground"}`}
          >
            <Wallet className="h-4 w-4" />
            <span
              className={`absolute top-2 right-2 h-1.5 w-1.5 rounded-full border border-background
                ${isWrongNetwork ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`}
            />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-background/95 backdrop-blur-xl border-border">
          <SheetHeader className="p-6 border-b border-border/40">
            <div className="flex items-center justify-between mb-4">
              <SheetTitle className="flex items-center gap-2 text-xl font-semibold">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Account
              </SheetTitle>
              <div className="flex items-center gap-2">
                {badge && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-normal flex items-center gap-1 px-2 py-0.5 ${badge.className}`}
                  >
                    {badge.icon}
                    {badge.label}
                    {badge.hint && (
                      <span className="opacity-70">· {badge.hint}</span>
                    )}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] font-normal ${isWrongNetwork ? "border-red-500/30 text-red-400 bg-red-500/5" : "border-emerald-500/20 text-emerald-400 bg-emerald-500/5 px-2 py-0.5"}`}
                >
                  {networkConfig.name}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base truncate">
                    {truncate(address)}
                  </h3>
                  <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${isWrongNetwork ? "bg-red-500" : "bg-emerald-500"}`} />
                    {isWrongNetwork ? "Connection Restricted" : "Securely Connected"}
                  </span>
                </div>
                {activeWalletType === "privy" && privyUser && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {privyUser.email?.address ??
                      privyUser.google?.name ??
                      privyUser.twitter?.name ??
                      "Social Account"}
                  </p>
                )}
              </div>
              <Link
                href={`${networkConfig.explorerUrl}/address/${address}`}
                target="_blank"
                className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {isWrongNetwork && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 flex gap-3">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-red-200">Switch Network Needed</p>
                    <p className="text-[10px] text-red-200/60 leading-relaxed">
                      Please switch to {networkConfig.name} in your wallet to interact with Medialane.
                    </p>
                  </div>
                </div>
              )}

              {/* Portfolio Section */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground px-1">Portfolio</p>
                <div className="grid gap-1">
                  {[
                    { label: "Dashboard", icon: BarChart3, href: "/portfolio" },
                    { label: "My IP Assets", icon: Box, href: "/portfolio/assets" },
                    { label: "My Collections", icon: Layers, href: "/portfolio/collections" },
                    { label: "Active Listings", icon: ArrowRightLeft, href: "/portfolio/listings" },
                    { label: "Bids & Offers", icon: History, href: "/portfolio/offers" },
                    { label: "Activity Hub", icon: History, href: "/portfolio/activity" },
                  ].map((item) => (
                    <Link key={item.label} href={item.href} onClick={() => setOpen(false)}>
                      <div className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/20 transition-all cursor-pointer">
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 transition-all group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Creator Section */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground px-1">Creator Tools</p>
                <div className="grid gap-1">
                  {[
                    { label: "Mint IP Asset", icon: PlusCircle, href: "/create/asset" },
                    { label: "Deploy Collection", icon: Rocket, href: "/create/collection" },
                    { label: "IP Templates", icon: ShieldCheck, href: "/create/templates" },
                    { label: "Account Settings", icon: Settings, href: "/portfolio/settings" },
                  ].map((item) => (
                    <Link key={item.label} href={item.href} onClick={() => setOpen(false)}>
                      <div className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/20 transition-all cursor-pointer">
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 transition-all group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-6 border-t border-border/40 mt-auto">
            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="w-full h-11 border-border/40 hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive group transition-all"
            >
              <LogOut className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
              Disconnect Wallet
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ---------------------------------------------------------------------------
  // Not connected — button + connect dialog showing connectors directly
  // ---------------------------------------------------------------------------

  return (
    <>
      <Button
        variant="ghost"
        size={label ? "default" : "icon"}
        className={
          className ??
          (label
            ? "h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            : "rounded-full h-9 w-9 bg-black/5 dark:bg-foreground/5 hover:bg-black/10 dark:hover:bg-foreground/10 border border-black/5 dark:border-foreground/5 transition-all text-foreground")
        }
        onClick={() => setConnectDialogOpen(true)}
      >
        <Wallet className="h-4 w-4" />
        {label && <span>{label}</span>}
      </Button>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
            <DialogDescription>
              Choose how you want to connect to Medialane.
            </DialogDescription>
          </DialogHeader>

          {sessionError && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-900/40 rounded p-2">
              {sessionError}
            </p>
          )}

          <div className="grid gap-5 pt-1">
            {/* ── Browser Wallets ──────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Browser Wallets
              </p>
              <div className="grid gap-2">
                {connectors.length > 0 ? (
                  connectors.map((connector) => {
                    const iconSrc = getConnectorIconSrc(
                      connector.icon as ConnectorIconObj | string | undefined
                    );
                    const displayName = getConnectorDisplayName(connector.id, connector.name);
                    return (
                      <Button
                        key={connector.id}
                        variant="outline"
                        className="w-full justify-start gap-3"
                        onClick={() => handleConnectorClick(connector)}
                        disabled={sessionConnecting || injectedConnectingId !== null}
                      >
                        {iconSrc ? (
                          <Image src={iconSrc} alt="" width={20} height={20} className="h-5 w-5 rounded shrink-0" unoptimized />
                        ) : (
                          <Wallet className="h-4 w-4 shrink-0" />
                        )}
                        <span>{displayName}</span>
                        {injectedConnectingId === connector.id && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
                      </Button>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    No browser wallets detected. Install Ready or Braavos to continue.
                  </p>
                )}
              </div>
            </section>

            <div className="border-t border-border/50" />

            {/* ── Cartridge ───────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Cartridge Controller
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Gaming wallet · auto-gasless transactions
              </p>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={handleCartridgeConnect}
                disabled={sessionConnecting}
              >
                <Gamepad2 className="h-4 w-4 shrink-0 text-purple-400" />
                <span>
                  {sessionConnecting ? "Connecting…" : "Connect with Cartridge"}
                </span>
                {sessionConnecting && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
              </Button>
            </section>

            <div className="border-t border-border/50" />

            {/* ── Social Login (Privy) ─────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Social Login
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Email · Google · Twitter — no seed phrase required
              </p>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={async () => {
                  setConnectDialogOpen(false);
                  try {
                    await walletConnect("privy");
                  } catch {
                    // error surfaced via session state
                  }
                }}
                disabled={sessionConnecting}
              >
                <Mail className="h-4 w-4 shrink-0 text-blue-400" />
                <span>
                  {sessionConnecting ? "Connecting…" : "Sign in with Email or Social"}
                </span>
                {sessionConnecting && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
