"use client";

import { MintLanding, type MintLandingCopy } from "@medialane/ui";
import { AirdropClaim } from "@/components/airdrop/airdrop-claim";

const MINT_COPY: MintLandingCopy = {
  image: { src: "/genesis.jpg", alt: "Medialane Creator's Airdrop", fallback: "Medialane Airdrop 2026" },
  badge: "Creators Fund Campaign",
  headline: { lead: "Join the", highlight: "Creator's Airdrop" },
  intro: "Medialane is an app for creators to publish, share, and monetize content. Free to join.",
  chips: ["Free to join", "Instant"],
  learnMore: "Learn more about the campaign",
  fund: {
    title: "Creator Fund",
    cards: [
      { title: "Join for free", body: "Connect a Starknet wallet in seconds." },
      { title: "Creator fund", body: "Fund distributions for all participants." },
      { title: "Boost your chances", body: "Create, share, and collect!" },
    ],
  },
  how: {
    eyebrow: "How it works",
    title: "Join in seconds.",
    account: { title: "Connect your wallet", tag: "Minimum — you're in", body: "Use your Starknet wallet." },
    create: {
      tag: "Bonus",
      title: "Create content",
      body: "Publish original work — photos, music, art, or writing. Creators get a larger share of each distribution.",
    },
    trade: {
      tag: "Biggest bonus",
      title: "Trade & collect",
      body: "Buy, sell, and collaborate with other creators. Active participants receive the highest share.",
    },
  },
  phases: {
    eyebrow: "Distribution",
    title: "Creator fund phases",
    first: {
      title: "Phase 1",
      tag: "5,000 members",
      body: "First distribution. All eligible participants get a proportional share based on their activity.",
    },
    second: {
      title: "Phase 2",
      tag: "10,000 members",
      body: "Second distribution, including all revenue since Phase 1. Activity scores recalculated from launch.",
    },
    note: "Both phases are planned for the first year of the platform. Milestones are targets, not guarantees — timing depends on growth.",
  },
  eligibility: {
    eyebrow: "Eligibility",
    title: "Who qualifies",
    items: [
      { ok: true, text: "Anyone who connects a wallet and claims a spot." },
      { ok: true, text: "Creators who publish original content get a higher share." },
      { ok: true, text: "Active participants who trade or collaborate get the most." },
      { ok: false, text: "Automated tools and duplicate accounts are disqualified." },
      { ok: false, text: "Artificially inflated activity is disqualified." },
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    paragraphs: [
      "Medialane is a content publishing and creator rewards platform. This campaign is not a financial product, investment scheme, lottery, or gambling service.",
      "Participation does not guarantee any financial return. Fund distributions, if any occur, may take the form of platform credits, digital assets, or other community resources.",
      "The participation record is a digital record of community membership. It has no inherent monetary value and is not a financial instrument.",
    ],
    agree: { lead: "By participating you agree to the", campaignTerms: "Campaign Terms", and: "and", terms: "Terms of Service" },
  },
  footer: {
    line: "Free to join · No purchase required ·",
    campaignTerms: "Campaign terms",
    links: { terms: "Terms", privacy: "Privacy", campaign: "Campaign", about: "About" },
  },
};

export function MintContent() {
  return <MintLanding copy={MINT_COPY} mint={<AirdropClaim storageKey="ml_mint" locale="en" />} />;
}
