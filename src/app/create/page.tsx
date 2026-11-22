import type { Metadata } from "next";
import Link from "next/link";
import {
  ImagePlus,
  Layers,
  Zap,
  Rocket,
  Store,
  Fingerprint,
  ShieldCheck,
  Globe2,
  Bolt,
  FileCode2,
  Cpu,
  Unlink,
  Lock,
  ArrowRight,
} from "lucide-react";
import { cn, IconTile } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Creator Studio";
const description = "New revenue for your intellectual property.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/create"),
  ...buildSocialMetadata({ title, description }),
};

const FEATURES = [
  {
    icon: Zap,
    title: "Simple sign-in",
    body: "Sign in with Google.",
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/5",
  },
  {
    icon: Rocket,
    title: "Creator Launchpad",
    body: "Launch collections and assets in a few clicks.",
    border: "border-violet-500/20",
    bg: "bg-violet-500/5",
  },
  {
    icon: Store,
    title: "NFT Marketplace",
    body: "Earn royalties on every resale.",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
  },
  {
    icon: Fingerprint,
    title: "Immutable Provenance",
    body: "Timestamped proof of ownership.",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
  },
  {
    icon: ShieldCheck,
    title: "Censorship Resistance",
    body: "Content stays onchain for good.",
    border: "border-rose-500/20",
    bg: "bg-rose-500/5",
  },
  {
    icon: Lock,
    title: "Onchain Sovereignty",
    body: "Self-custodied assets you control.",
    border: "border-indigo-500/20",
    bg: "bg-indigo-500/5",
  },
  {
    icon: Globe2,
    title: "Global Protection",
    body: "Authorship recognized in 181 countries.",
    border: "border-sky-500/20",
    bg: "bg-sky-500/5",
  },
  {
    icon: Bolt,
    title: "Atomic Settlement",
    body: "Asset and payment settle in one transaction.",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
  },
  {
    icon: FileCode2,
    title: "Embedded Licensing",
    body: "Usage terms live in the asset.",
    border: "border-fuchsia-500/20",
    bg: "bg-fuchsia-500/5",
  },
  {
    icon: Cpu,
    title: "Onchain Composability",
    body: "Apps and AI can read IP permissions onchain.",
    border: "border-teal-500/20",
    bg: "bg-teal-500/5",
  },
  {
    icon: Unlink,
    title: "Claim Any Collection",
    body: "Claim existing Starknet collections.",
    border: "border-orange-500/20",
    bg: "bg-orange-500/5",
  },
] as const;

const ACTIONS = [
  {
    href: "/launchpad/single-editions",
    icon: ImagePlus,
    label: "Mint IP Asset",
    description:
      "Turn any creative work into an IP asset.",
    ring: "hover:ring-violet-500/30",
  },
  {
    href: "/launchpad/single-editions/collection",
    icon: Layers,
    label: "Deploy Collection",
    description:
      "Launch a collection and start minting.",
    ring: "hover:ring-blue-500/30",
  },
] as const;

export default function CreatePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 space-y-12 sm:space-y-16">

        <div className="max-w-2xl space-y-4 sm:space-y-5">

          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300 backdrop-blur-sm">
            <Rocket className="h-3.5 w-3.5" />
            Creator Studio
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.06] tracking-tight text-foreground">
            Mint, protect &amp;{" "}
            <span className="text-primary">generate revenue</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
            Unique monetization services — global, and truly yours on Starknet.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-2xl">
          {ACTIONS.map(({ href, icon: Icon, label, description, ring }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative rounded-2xl border border-border bg-card p-5 sm:p-6 ring-2 ring-transparent transition-all duration-300",
                "hover:border-border/80 hover:shadow-lg hover:shadow-primary/5",
                ring
              )}
            >

              <IconTile className="mb-4 sm:mb-5">
                <Icon />
              </IconTile>

              <h2 className="text-base sm:text-lg font-bold text-foreground mb-2">{label}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

              <div className="mt-4 sm:mt-5 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                Get started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-2xs uppercase tracking-widest text-muted-foreground/60 font-semibold whitespace-nowrap">
            Platform Features
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {FEATURES.map(({ icon: Icon, title, body, border, bg }) => (
            <div
              key={title}
              className={cn(
                "relative rounded-2xl border p-4 sm:p-5 space-y-3 transition-all duration-200 hover:shadow-sm group",
                border,
                bg
              )}
            >

              <IconTile size="sm">
                <Icon />
              </IconTile>

              <div className="space-y-1">
                <h3 className="font-bold text-sm text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-8">
            {[
              { value: "181", label: "Countries protected" },
              { value: "Zero fees", label: "to mint & sell" },
              { value: "Direct", label: "to your wallet" },
              { value: "Programmable", label: "royalties & licensing" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center space-y-1">
                <p className="text-2xl sm:text-3xl font-black text-foreground">{value}</p>
                <p className="text-2xs uppercase tracking-widest text-muted-foreground/70 font-medium">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
