"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import { Menu } from "lucide-react";
import { NavCommandMenu, useNavCommandMenu } from "@medialane/ui";
import { NotificationSpotlight } from "@/components/shared/notification-spotlight";
import { Aurora } from "@/components/ui/aurora";
import { MedialaneLogo } from "@/components/brand/medialane-logo";
import { NAV_COMMANDS } from "@/lib/nav-commands";
import { NavAccountPanel } from "@/components/nav-account-panel";
import { NavThemeToggle } from "@/components/nav-theme-toggle";
import { SWRConfig } from "swr";
import { StarknetProvider } from "@/components/starknet-provider";
import { WalletProvider } from "@/wallet";
import { UserRegistration } from "@/components/shared/user-registration";
import { PrivyConnectDialog } from "@/components/wallet/privy-connect-dialog";

function NavTrigger() {
  const { open } = useNavCommandMenu();

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open navigation"
      className="group flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Image
        src="/icon.png"
        alt="Medialane"
        width={32}
        height={32}
        className="h-8 w-8 rounded-full opacity-90 transition-opacity group-hover:opacity-100"
        priority
      />
      <Menu className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <NavCommandMenu commands={NAV_COMMANDS} accountSlot={<NavAccountPanel />} footerSlot={<NavThemeToggle />} />
      <div className="fixed top-4 left-4 sm:left-6 lg:left-8 z-50 flex items-center gap-1.5">
        <NavTrigger />
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
    pathname === "/mint" || pathname === "/airdrop" || pathname.startsWith("/br/");

  return (
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
        {/* StarknetProvider OUTER (injected wallets + contract reads); WalletProvider
            owns the single wallet store and all Privy mounting internally. */}
        <StarknetProvider>
          <WalletProvider>
            <Aurora />
            <UserRegistration />
            {isStandalone ? children : <Shell>{children}</Shell>}
            {!isStandalone && <NotificationSpotlight />}
            <PrivyConnectDialog />
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
        </StarknetProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}
