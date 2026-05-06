import { BookOpen, FileCode2 } from "lucide-react";
import { CtaCardGrid } from "@medialane/ui";
import type { CtaCardItem } from "@medialane/ui";

const CARDS: CtaCardItem[] = [
  {
    icon: BookOpen,
    title: "Learn",
    description: "Understand NFTs, programmable IP licensing, and how to grow as a creator on Medialane.",
    links: [
      { label: "NFT Fundamentals",       href: "https://www.medialane.io/learn/nft" },
      { label: "Creator Launchpad",      href: "https://www.medialane.io/learn/creator-launchpad" },
      { label: "Programmable Licensing", href: "https://www.medialane.io/learn/programmable-licensing" },
    ],
    href: "https://www.medialane.io/learn",
    gradient: "bg-gradient-to-br from-brand-purple to-brand-blue",
    iconGradient: "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/20",
  },
  {
    icon: FileCode2,
    title: "Docs",
    description: "Integrate with the Medialane API, deploy smart contracts, and build on our protocol.",
    links: [
      { label: "API Reference",       href: "https://docs.medialane.io/api" },
      { label: "Protocol & Contracts", href: "https://docs.medialane.io/protocol" },
      { label: "Developer Guide",     href: "https://docs.medialane.io/developers" },
    ],
    href: "https://docs.medialane.io",
    gradient: "bg-gradient-to-br from-brand-blue to-brand-navy",
    iconGradient: "bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/20",
  },
];

export function LearnDocsCta() {
  return <CtaCardGrid cards={CARDS} />;
}
