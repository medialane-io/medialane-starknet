"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import type { NavCommandGroup } from "@medialane/ui";
import { NavCommandMenu, NavBrandButton, NavAccountSheet, ThemeAmbientBackground } from "@medialane/ui";
import { NotificationSpotlight } from "@/components/shared/notification-spotlight";
import { useCreatorProfile } from "@/hooks/use-profiles";
import { resolveTokenImage } from "@/lib/utils";

import { MedialaneLogo } from "@/components/brand/medialane-logo";
import { NAV_COMMANDS } from "@/lib/nav-commands";
import { HeaderWalletTrigger } from "@/components/nav-wallet-trigger";
import { AccountPanel } from "@/components/account-panel";
import { ConnectDialog, useConnectDialog } from "@/components/connect-dialog";
import { NavThemeToggle } from "@/components/nav-theme-toggle";
import { NavConnectButton } from "@/components/nav-connect-button";
import { SWRConfig } from "swr";
import { StarknetProvider } from "@/components/starknet-provider";
import { WalletProvider } from "@/contexts/wallet-context";
import { UserRegistration } from "@/components/shared/user-registration";
import { useWallet } from "@/hooks/use-wallet";

function Shell({ children }: { children: React.ReactNode }) {

  const pathname = usePathname();
  const suppressAmbient =
    pathname.startsWith("/asset/") ||
    pathname.startsWith("/collections/") ||
    pathname.startsWith("/creator/");
  const { isConnected, disconnect, address } = useWallet();
  const { profile } = useCreatorProfile(address ?? undefined);
  const themeImageUrl = suppressAmbient ? null : resolveTokenImage(profile?.avatarImage);
  const { open: openConnectDialog } = useConnectDialog();
  const commands = useMemo<NavCommandGroup[]>(
    () => [
      ...NAV_COMMANDS,
      {
        heading: "Account",
        items: [
          isConnected
            ? { id: "logout", label: "Log out", icon: LogOut, action: disconnect, keywords: ["disconnect", "sign out", "logout"] }
            : { id: "login", label: "Log in", icon: LogIn, action: openConnectDialog, keywords: ["connect", "sign in", "wallet", "login"] },
        ],
      },
    ],
    [isConnected, disconnect, openConnectDialog]
  );

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <ThemeAmbientBackground imageUrl={themeImageUrl} />
      <NavCommandMenu
        commands={commands}
        footerSlot={<NavThemeToggle />}
        showKeyboardHints={false}
        brandSlot={<NavConnectButton />}
      />
      <NavAccountSheet>
        <AccountPanel />
      </NavAccountSheet>
      <ConnectDialog />
      <div className="fixed top-4 left-4 sm:left-6 lg:left-8 z-50">
        <NavBrandButton />
      </div>
      <div className="fixed top-4 right-4 sm:right-6 lg:right-8 z-50">
        <HeaderWalletTrigger />
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

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone =
    pathname === "/mint" ||
    pathname === "/airdrop";

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <SWRConfig
        value={{
          onError: (err: unknown) => {
            const status =
              err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
                ? (err as { status: number }).status
                : null;

            if (status === 404) return;

            console.error("request failed", err);
          },
        }}
      >
        <StarknetProvider>
          <WalletProvider>
            <UserRegistration />
            {isStandalone ? children : <Shell>{children}</Shell>}
            {!isStandalone && <NotificationSpotlight />}
          </WalletProvider>
        </StarknetProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}
