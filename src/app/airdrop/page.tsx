import type { Metadata } from "next";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Shield,
  UserCheck,
  PenLine,
  ShoppingCart,
} from "lucide-react";
import { MedialaneLogo } from "@/components/brand/medialane-logo";
import { AirdropEventCard } from "@/components/airdrop/genesis-mint";
import { AirdropClaim } from "@/components/airdrop/airdrop-claim";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Creator's Airdrop | Medialane",
  description:
    "How the Medialane Creator's Airdrop works: what earns XP, how distributions happen, and how to join.",
  alternates: canonical("/airdrop"),
  openGraph: {
    title: "Creator's Airdrop | Medialane",
    description:
      "How the Medialane Creator's Airdrop works: what earns XP, how distributions happen, and how to join.",
    url: "/airdrop",
    type: "website",
  },
};

const EARN_GROUPS = [
  {
    icon: UserCheck,
    color: "text-brand-blue",
    bg: "bg-brand-blue/10",
    title: "Get started",
    desc: "Connect your wallet and confirm your claim. You're included from that point on, and it's the only requirement.",
  },
  {
    icon: PenLine,
    color: "text-brand-purple",
    bg: "bg-brand-purple/10",
    title: "Create",
    desc: "Publish original work, launch collections or drops. Each action adds to your XP.",
  },
  {
    icon: ShoppingCart,
    color: "text-brand-orange",
    bg: "bg-brand-orange/10",
    title: "Trade and engage",
    desc: "Buy, sell, collaborate. This adds to the same XP total too.",
  },
];

export default function AirdropPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">

      <header className="px-6 py-4 flex items-center border-b border-border/30">
        <MedialaneLogo />
      </header>

      <div className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">

          <section className="py-14 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/5 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-brand-orange" />
                  <span className="text-xs font-semibold text-brand-orange">Airdrop Campaign</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
                  Creator&apos;s{" "}
                  <span className="bg-gradient-to-r from-brand-rose to-brand-orange bg-clip-text text-transparent">
                    Fund
                  </span>
                </h1>
                <p className="text-base lg:text-lg text-muted-foreground leading-relaxed">
                  Join the Creator&apos;s Airdrop to earn XP toward the Creator&apos;s Fund. Connect your wallet to get started.
                </p>
                <AirdropClaim storageKey="ml_airdrop" locale="en" />
              </div>

              <div className="lg:top-24 space-y-4">
                <AirdropEventCard />
              </div>

            </div>
          </section>

          <section className="py-10 border-t border-border/30 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">How you earn</p>
              <h2 className="text-2xl sm:text-3xl font-black">Every real interaction earns XP</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Your total XP relative to everyone else&apos;s decides your share of each
                distribution. Connecting your wallet is enough to be included; everything below
                adds to the same running total.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {EARN_GROUPS.map(({ icon: Icon, color, bg, title, desc }) => (
                <div key={title} className="flex flex-col gap-4 p-5 rounded-2xl border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
                  <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="py-10 border-t border-border/30 space-y-4">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">The Creator&apos;s Fund</p>
              <h2 className="text-2xl sm:text-3xl font-black">A public wallet, split by XP</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A share of what Medialane earns is set aside in one public wallet. Each time it
                reaches its threshold, it&apos;s airdropped to everyone taking part, split by XP.
                This runs through July 2027. Read the full mechanic and watch the live wallet at{" "}
                <span className="text-foreground font-medium">medialane.org/creators-fund</span>.
              </p>
              <span className="block tabular-nums text-xs text-muted-foreground/70 break-all">0x064c51746dbcb7498cc6e4b8abfcacd60805c0762b0411bb0515c611b5ae8223</span>
            </div>
          </section>

          <section className="py-10 border-t border-border/30">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Rules</p>
                  <h2 className="text-2xl font-black">Participation rules</h2>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Who can join</p>
                  <div className="space-y-2">
                    {[
                      "Anyone who creates a free Medialane account.",
                      "Approval-free, open to everyone.",
                    ].map((text) => (
                      <div key={text} className="flex items-start gap-3">
                        <div className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        </div>
                        <span className="text-sm text-muted-foreground leading-relaxed">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-destructive/70">What gets you removed</p>
                  <div className="space-y-2">
                    {[
                      "Automated bots or duplicate registrations.",
                      "Artificially inflating activity or scores.",
                    ].map((text) => (
                      <div key={text} className="flex items-start gap-3">
                        <div className="h-5 w-5 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                          <XCircle className="h-3 w-3 text-destructive" />
                        </div>
                        <span className="text-sm text-muted-foreground leading-relaxed">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-2xl font-black">Disclaimer</h2>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>Medialane is a content publishing and creator rewards platform. This campaign is not a financial product, investment scheme, lottery, or gambling service.</p>
                  <p>Participation does not guarantee any financial return. Fund distributions, if any occur, may take the form of platform credits, digital assets, or other community resources.</p>
                  <p>The participation record is a digital record of community membership. It has no inherent monetary value and is not a financial instrument.</p>
                  <p>
                    By participating you agree to the{" "}
                    <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Campaign Terms</a>
                    {" "}and{" "}
                    <a href="https://docs.medialane.io/guidelines/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Terms of Service</a>.
                  </p>
                </div>
              </div>

            </div>
          </section>

          <div className="pb-12" />
        </div>
      </div>

      <footer className="border-t border-border/40">
        <p className="text-[11px] text-center text-muted-foreground/50 px-5 pt-4">
          Free to join · No purchase required ·{" "}
          <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground/80 transition-colors">Campaign terms</a>
        </p>
        <div className="px-5 py-4 flex items-center justify-center gap-5 text-xs text-muted-foreground flex-wrap">
          <a href="https://docs.medialane.io/guidelines/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms</a>
          <a href="https://docs.medialane.io/guidelines/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Campaign</a>
          <a href="https://docs.medialane.io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
          <span>© {new Date().getFullYear()} Medialane</span>
        </div>
      </footer>
    </div>
  );
}
