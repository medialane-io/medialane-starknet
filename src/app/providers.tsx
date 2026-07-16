"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import { NavCommandMenu, NavBrandButton } from "@medialane/ui";
import { NotificationSpotlight } from "@/components/shared/notification-spotlight";

import { MedialaneLogo } from "@/components/brand/medialane-logo";
import { NAV_COMMANDS } from "@/lib/nav-commands";
import { NavAccountPanel } from "@/components/nav-account-panel";
import { NavThemeToggle } from "@/components/nav-theme-toggle";
import { SWRConfig } from "swr";
import { StarknetProvider } from "@/components/starknet-provider";
import { StarkZapWalletProvider } from "@/contexts/starkzap-wallet-context";
import { WalletProvider } from "@/contexts/wallet-context";
import { UserRegistration } from "@/components/shared/user-registration";

// TEMPORARY (2026-07-16) — surfaces any uncaught client-side JS error as a
// visible toast, to diagnose the launchpad "Upload image does nothing" report
// on prod (where wallet-gated flows make local repro impossible). Remove once
// the root cause is found — this is not meant to ship long-term.
function DebugErrorToast() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      toast.error(`Debug JS error: ${e.message}`, {
        description: (e.error?.stack ?? "").slice(0, 300),
        duration: 15000,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
      const stack = e.reason instanceof Error ? e.reason.stack : undefined;
      toast.error(`Debug promise rejection: ${reason}`, {
        description: (stack ?? "").slice(0, 300),
        duration: 15000,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <NavCommandMenu commands={NAV_COMMANDS} accountSlot={<NavAccountPanel />} footerSlot={<NavThemeToggle />} />
      <div className="fixed top-4 left-4 sm:left-6 lg:left-8 z-50">
        <NavBrandButton />
      </div>
      <main className="min-w-0 flex-1 bg-background overflow-x-hidden">{children}</main>
      <footer className="bg-background border-t border-border/60 px-6 py-8 mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="text-xs">© {new Date().getFullYear()} Medialane DAO</p>
          <nav className="flex items-center gap-4 flex-wrap justify-center">
            <Link href="/marketplace" className="hover:text-foreground transition-colors">Trade</Link>
            <Link href="/launchpad" className="hover:text-foreground transition-colors">Launch</Link>
            <a href="https://docs.medialane.io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
            <a href="https://docs.medialane.io/guidelines/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms</a>
            <a href="https://docs.medialane.io/guidelines/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="https://x.com/medialane_io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">X</a>
          </nav>
          <div className="flex items-center gap-2">
            <MedialaneLogo />
          </div>
        </div>
      </footer>
    </div>
  );
}

// PrivyProvider and PrivyConnector are dynamically imported so they are
// never bundled or executed for users who don't use Privy.
//
// PrivyConnector renders inside StarkZapWalletProvider (passed in as a prop)
// so it has access to the provider's setters. PrivyProvider wraps the whole
// tree so usePrivy() inside PrivyConnector resolves.
import type { PrivyConnectorProps } from "@/contexts/privy-connector";

let PrivyStack: React.ComponentType<{ children: React.ReactNode }> | null = null;
let PrivyConnectorComponent: React.ComponentType<PrivyConnectorProps> | null = null;

async function loadPrivyStack() {
  if (PrivyStack && PrivyConnectorComponent) return;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set — Privy onboarding cannot start.");
  }
  const [{ PrivyProvider }, connectorMod] = await Promise.all([
    import("@privy-io/react-auth"),
    import("@/contexts/privy-connector"),
  ]);
  PrivyConnectorComponent = connectorMod.PrivyConnector;
  const PRIVY_CONFIG = {
    loginMethods: ["email", "google", "twitter"] as Array<"email" | "google" | "twitter">,
    appearance: { theme: "dark" as const },
  };
  function PrivyStackInner({ children }: { children: React.ReactNode }) {
    return (
      <PrivyProvider appId={appId!} config={PRIVY_CONFIG}>
        {children}
      </PrivyProvider>
    );
  }
  PrivyStack = PrivyStackInner;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone =
    pathname === "/mint" ||
    pathname === "/airdrop" ||
    pathname.startsWith("/br/");

  // Privy is only mounted if the user has previously chosen it as their wallet.
  const [privyActive, setPrivyActive] = useState(false);
  const [PrivyWrapper, setPrivyWrapper] = useState<React.ComponentType<{ children: React.ReactNode }> | null>(null);
  const [PrivyConnectorMount, setPrivyConnectorMount] = useState<React.ComponentType<PrivyConnectorProps> | null>(null);

  const activatePrivy = () => {
    setPrivyWrapper(() => PrivyStack);
    setPrivyConnectorMount(() => PrivyConnectorComponent);
    setPrivyActive(true);
  };

  useEffect(() => {
    // Mount Privy on reload ONLY when it is the user's persisted wallet choice.
    // (Previously this fired for any stale ml_privy_session on every route,
    // which let Privy auto-reconnect and hijack an actively-connected wallet.)
    if (localStorage.getItem("ml_wallet") === "privy") {
      loadPrivyStack().then(activatePrivy).catch((err) => {
        console.error("[Privy] restore load failed:", err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isMintLanding = pathname.startsWith("/br/") || pathname === "/mint" || pathname.startsWith("/mint/");
    if (!isMintLanding) return;
    loadPrivyStack().then(activatePrivy).catch((err) => {
      console.error("[Privy] mint-landing pre-mount failed:", err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleRequestPrivy = () => {
    if (privyActive) return;
    loadPrivyStack()
      .then(activatePrivy)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load Privy";
        console.error("[Privy] loadPrivyStack failed:", err);
        toast.error(msg);
      });
  };

  const content = (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <SWRConfig
        value={{
          onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : "Something went wrong";
            if (
              msg.includes("401") || msg.includes("403") ||
              msg.includes("Missing") ||
              msg.includes("Failed to fetch") || msg.includes("Load failed") ||
              msg.includes("NetworkError") || msg.includes("network")
            ) return;
            toast.error(msg);
          },
        }}
      >
        <StarknetProvider>
          <StarkZapWalletProvider onRequestPrivy={handleRequestPrivy} PrivyConnector={PrivyConnectorMount}>
            <WalletProvider>
            <DebugErrorToast />
            <UserRegistration />
            {isStandalone ? children : <Shell>{children}</Shell>}
            {!isStandalone && <NotificationSpotlight />}
            <Toaster
              richColors
              position="bottom-center"
              duration={3500}
              gap={4}
              toastOptions={{
                classNames: {
                  toast: "rounded-xl shadow-lg border border-border/50 font-sans text-[13px] px-4 py-3",
                  title: "font-medium",
                  description: "text-xs opacity-70 mt-0.5",
                  actionButton: "rounded-lg text-xs font-medium",
                  cancelButton: "rounded-lg text-xs",
                },
              }}
            />
            </WalletProvider>
          </StarkZapWalletProvider>
        </StarknetProvider>
      </SWRConfig>
    </ThemeProvider>
  );

  // Wrap with Privy only when active — invisible to all other users
  return PrivyWrapper ? <PrivyWrapper>{content}</PrivyWrapper> : content;
}
