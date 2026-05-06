"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { Aurora } from "@/components/ui/aurora";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MedialaneLogo } from "@/components/brand/medialane-logo";
import { SWRConfig } from "swr";
import { StarknetProvider } from "@/components/starknet-provider";
import { StarkZapWalletProvider } from "@/contexts/starkzap-wallet-context";

function Shell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (sessionStorage.getItem("ml-mainnet-notice-shown")) return;
    sessionStorage.setItem("ml-mainnet-notice-shown", "1");
    toast.warning("Medialane is live on Starknet Mainnet — early testing phase. Proceed with caution.", {
      duration: 12000,
      id: "mainnet-notice",
    });
  }, []);

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <SidebarTrigger className="absolute top-3 left-3 z-50" />
        <main className="flex-1 bg-background overflow-x-hidden">{children}</main>
        <footer className="bg-background border-t border-border/60 px-6 py-8 mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MedialaneLogo />
            </div>
            <nav className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/marketplace" className="hover:text-foreground transition-colors">Trade</Link>
              <Link href="/launchpad" className="hover:text-foreground transition-colors">Launch</Link>
              <a href="https://docs.medialane.io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
              <a href="https://docs.medialane.io/terms-of-use" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms</a>
              <a href="https://docs.medialane.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="https://x.com/medialane_io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">X</a>
            </nav>
            <p className="text-xs">© {new Date().getFullYear()} Medialane DAO</p>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <SWRConfig
        value={{
          onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : "Something went wrong";
            // Suppress auth errors and network-level errors — these surface from hooks
            // that use x-wallet-address auth or from brief connectivity gaps, and
            // are not actionable from a toast. Real app errors propagate via hook's
            // own error state and UI.
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
          <StarkZapWalletProvider>
            <Aurora />
            <Shell>{children}</Shell>
            <CartDrawer />
            <Toaster richColors position="bottom-right" />
          </StarkZapWalletProvider>
        </StarknetProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}
