import { navGroups } from "@medialane/ui";
import { Bell, Coins, Gift, List, Repeat2, Ticket } from "lucide-react";

export const NAV_COMMANDS = navGroups([
  {
    items: [
      "home", "discover", "marketplace", "launchpad", "portfolio",
    ],
  },
  {
    heading: "Navigate",
    items: [
      "collections", "coins", "creators", "activities", "rewards", "airdrop",
      { id: "claim", label: "Genesis Claim", icon: Gift, href: "/claim", keywords: ["airdrop", "claim", "free", "drop", "genesis"] },
      { id: "notifications", label: "Notifications", icon: Bell, href: "/notifications", keywords: ["alerts", "updates", "offers"] },
      "settings",
    ],
  },
  {
    heading: "Create & Mint",
    items: [
      "mint-ip-asset", "create-collection", "mint-editions", "create-1155", "collection-drop", "browse-drops",
      { id: "my-drops", label: "My Drops", icon: List, href: "/launchpad/drop/my-drops", keywords: ["drop", "manage", "created"] },
      "pop-create", "pop-browse",
      { id: "my-pop-events", label: "My POP Events", icon: Ticket, href: "/launchpad/pop/my-events", keywords: ["pop", "manage", "events"] },
      "tickets-create", "tickets-browse", "club-create", "club-browse", "sponsorship-create", "sponsorship-browse",
      "launch-coin",
      { id: "claim-memecoin", label: "Claim a Memecoin", icon: Coins, href: "/launchpad/memecoin", keywords: ["memecoin", "claim", "coin", "starknet", "unrug", "token"] },
      "remix",
    ],
  },
  {
    heading: "Portfolio",
    items: [
      "portfolio-assets", "portfolio-listings", "portfolio-offers", "portfolio-received",
      { id: "portfolio-counter-offers", label: "Counter Offers", icon: Repeat2, href: "/portfolio/counter-offers", keywords: ["counter", "negotiation", "offers"] },
      { id: "portfolio-licensing", label: "Licensing", icon: Repeat2, href: "/portfolio/licensing", keywords: ["license", "licensing", "remix", "requests"] },
      "portfolio-collections", "portfolio-activity",
    ],
  },
  {
    heading: "Explore by type",
    items: [
      "audio", "art", "video", "photography", "publications", "nft",
    ],
  },
  {
    heading: "Documentation",
    items: [
      "docs", "docs-market", "docs-launchpad", "docs-ip", "docs-sdk", "docs-terms", "docs-privacy",
    ],
  },
]);
