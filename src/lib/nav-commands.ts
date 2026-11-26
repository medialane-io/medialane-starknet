import { navGroups } from "@medialane/ui";
import { Coins, Gift, Repeat2 } from "lucide-react";

export const NAV_COMMANDS = navGroups([
  {
    items: [
      "home", "discover", "marketplace", "launchpad", "portfolio",
    ],
  },
  {
    heading: "Navigate",
    items: [
      "collections", "coins", "rewards", "airdrop",
      { id: "claim", label: "Genesis Claim", icon: Gift, href: "/claim", keywords: ["airdrop", "claim", "free", "drop", "genesis"] },
      "settings",
    ],
  },
  {
    heading: "Creator Launchpad",
    items: [
      "mint-ip-asset", "mint-editions", "remix", "create-collection", "create-1155", "nft-drop",
      "launch-coin",
      { id: "claim-memecoin", label: "Existing Memecoin", icon: Coins, href: "/launchpad/memecoin", keywords: ["memecoin", "claim", "coin", "starknet", "unrug", "token"] },
      "pop-create", "tickets-create", "club-create", "sponsorship-create",
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
      "docs", "docs-terms", "docs-privacy",
    ],
  },
]);
