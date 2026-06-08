"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useWallet } from "@/hooks/use-wallet";
import {
  Telescope, Compass, Store, Coins, Briefcase, Plus, Activity,
  LayoutGrid, Users, Search, Sun, Moon,
  BookOpen, ChevronRight, Music, Palette, Film, Camera, Gem, Trophy,
} from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useUnreadOffers } from "@/hooks/use-unread-offers";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MedialaneLogo } from "../brand/medialane-logo";
import { MedialaneIcon } from "../brand/medialane-icon";
import { NotificationsItem } from "@/components/layout/notifications-sheet";

// ── Explore sub-menu: IP types only ─────────────────────────────────────────

const EXPLORE_SUB = [
  { href: "/audio", label: "Audio", icon: Music },
  { href: "/art", label: "Art", icon: Palette },
  { href: "/video", label: "Video", icon: Film },
  { href: "/photography", label: "Photography", icon: Camera },
  { href: "/nft", label: "NFT", icon: Gem },
];

interface CollapsibleNavItemProps {
  label: string;
  icon: React.ElementType;
  sub: { href: string; label: string; icon: React.ElementType }[];
  defaultOpen?: boolean;
  tooltip?: string;
  onClose: () => void;
}

function CollapsibleNavItem({
  label, icon: Icon, sub, defaultOpen = false, tooltip, onClose,
}: CollapsibleNavItemProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(defaultOpen);
  const { state, isMobile, setOpen: setSidebarOpen } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const isAnySubActive = sub.some((item) => pathname === item.href || pathname?.startsWith(item.href + "/"));

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={tooltip ?? label}
          isActive={isAnySubActive}
          onClick={() => {
            setSidebarOpen(true);
            setOpen(true);
          }}
        >
          <Icon />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={tooltip ?? label} isActive={isAnySubActive && !open}>
            <Icon />
            <span>{label}</span>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {sub.map(({ href, label: subLabel, icon: SubIcon }) => {
              const active = pathname === href || pathname?.startsWith(href + "/");
              return (
                <SidebarMenuSubItem key={href}>
                  <SidebarMenuSubButton asChild isActive={active} onClick={onClose}>
                    <Link href={href}>
                      <SubIcon className="h-3.5 w-3.5" />
                      {subLabel}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

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

// ── Sidebar ──────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname();
  const { address: walletAddress, isConnected } = useWallet();
  const unreadOffers = useUnreadOffers(isConnected ? walletAddress : null);
  const { setOpen, setOpenMobile, isMobile, state } = useSidebar();

  const closeSidebar = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  const onLaunchpad = !!(pathname?.startsWith("/launchpad") || pathname?.startsWith("/create"));
  const onExplore = !!(
    pathname?.startsWith("/audio") ||
    pathname?.startsWith("/art") ||
    pathname?.startsWith("/video") ||
    pathname?.startsWith("/photography") ||
    pathname?.startsWith("/nft")
  );

  return (
    <Sidebar collapsible="icon">

      {/* Brand */}
      <SidebarMenu className="p-2">
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild onClick={closeSidebar}>
            {isMobile || state === "expanded" ? <MedialaneLogo /> : <MedialaneIcon />}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <SidebarContent>

        {/* ── Main navigation + Explore (single group, no gap) ── */}
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
                  <Store />
                  <span>Marketplace</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Coins */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!!pathname?.startsWith("/coins")}
                tooltip="Coins"
                onClick={closeSidebar}
              >
                <Link href="/coins">
                  <Coins />
                  <span>Coins</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Launchpad */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={onLaunchpad}
                tooltip="Launchpad"
                onClick={closeSidebar}
              >
                <Link href="/launchpad">
                  <Plus />
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

            {/* Rewards */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!!pathname?.startsWith("/rewards")}
                tooltip="Rewards"
                onClick={closeSidebar}
              >
                <Link href="/rewards">
                  <Trophy />
                  <span>Rewards</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Explore */}
            <CollapsibleNavItem
              label="Explore"
              icon={Compass}
              sub={EXPLORE_SUB}
              defaultOpen={onExplore}
              tooltip="Explore by type"
              onClose={closeSidebar}
            />

          </SidebarMenu>
        </SidebarGroup>

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
            <NotificationsItem />
            <ThemeToggleItem />
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Docs" onClick={closeSidebar}>
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
                !isMobile && state === "collapsed" ? "justify-center px-0" : "px-1"
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
