"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import {
  Telescope, Compass, Briefcase, Zap, Activity,
  LayoutGrid, Users, Search, Sun, Moon, ShoppingBag,
  BookOpen,
} from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useUnreadOffers } from "@/hooks/use-unread-offers";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { MedialaneLogo } from "../brand/medialane-logo";
import { MedialaneIcon } from "../brand/medialane-icon";
import { NotificationsItem } from "@/components/layout/notifications-sheet";

// ── Utility items ─────────────────────────────────────────────────────────────

function ThemeToggleItem() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        tooltip={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <Sun /> : <Moon />}
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function CartItem() {
  const { items, toggleCart } = useCart();
  const count = items.length;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={toggleCart} tooltip={count > 0 ? `Cart (${count})` : "Cart"}>
        <div className="relative">
          <ShoppingBag className="size-4" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </div>
        <span>Cart{count > 0 ? ` (${count})` : ""}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname();
  const { address: walletAddress, isConnected } = useUnifiedWallet();
  const unreadOffers = useUnreadOffers(isConnected ? walletAddress : null);
  const { setOpen, setOpenMobile, isMobile } = useSidebar();

  const closeSidebar = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  return (
    <Sidebar collapsible="icon">

      {/* Brand */}
      <SidebarMenu className="p-2">
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild onClick={closeSidebar}>
            {isMobile ? <MedialaneLogo /> : <MedialaneIcon />}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <SidebarContent>

        {/* ── Main navigation ──────────────────────────────── */}
        <SidebarGroup>
          <SidebarMenu>

            {/* Discover */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/discover"}
                tooltip="Discover"
                onClick={closeSidebar}
              >
                <Link href="/discover">
                  <Telescope />
                  <span>Discover</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Marketplace */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/marketplace"}
                tooltip="Marketplace"
                onClick={closeSidebar}
              >
                <Link href="/marketplace">
                  <Compass />
                  <span>Marketplace</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Launchpad */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!!pathname?.startsWith("/launchpad") || !!pathname?.startsWith("/create")}
                tooltip="Launchpad"
                onClick={closeSidebar}
              >
                <Link href="/launchpad">
                  <Zap />
                  <span>Launchpad</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Portfolio with unread badge */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!!pathname?.startsWith("/portfolio")}
                tooltip={
                  unreadOffers > 0
                    ? `Portfolio (${unreadOffers} new offer${unreadOffers > 1 ? "s" : ""})`
                    : "Portfolio"
                }
                onClick={closeSidebar}
              >
                <Link href="/portfolio" prefetch={false} className="relative">
                  <Briefcase />
                  <span>Portfolio</span>
                  {unreadOffers > 0 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 h-4 min-w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center px-1">
                      {unreadOffers > 9 ? "9+" : unreadOffers}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Collections */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!!pathname?.startsWith("/collections")}
                tooltip="Collections"
                onClick={closeSidebar}
              >
                <Link href="/collections">
                  <LayoutGrid />
                  <span>Collections</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Creators */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!!pathname?.startsWith("/creators")}
                tooltip="Creators"
                onClick={closeSidebar}
              >
                <Link href="/creators">
                  <Users />
                  <span>Creators</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Activity */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/activities"}
                tooltip="Activity"
                onClick={closeSidebar}
              >
                <Link href="/activities">
                  <Activity />
                  <span>Activity</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {/* ── Utilities ────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Search" onClick={closeSidebar}>
                <Link href="/search">
                  <Search />
                  <span>Search</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <ThemeToggleItem />
            <CartItem />
            <NotificationsItem />
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Docs">
                <a href="https://docs.medialane.io" target="_blank" rel="noopener noreferrer">
                  <BookOpen />
                  <span>Docs</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

      </SidebarContent>

      {/* ── Wallet footer ────────────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div
              className={cn(
                "flex items-center py-1.5",
                !isMobile ? "justify-center px-0" : "px-1"
              )}
            >
              <ConnectWallet />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  );
}
