"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { ApiOrder, ApiToken } from "@medialane/sdk";
import { checkIsOwner } from "@/lib/utils";
import { LICENSE_TRAIT_TYPES } from "@/types/ip";
import type { IPType } from "@/types/ip";
import { IP_TEMPLATES, EMBED_PLATFORM_META, SOCIAL_PLATFORM_META } from "@/lib/ip-templates";

/**
 * The backend enriches tokens with fields not yet declared on the SDK's
 * `ApiToken` (SDK 0.12.0): per-holder `balances` and the `isHidden` flag.
 * `AssetToken` is the local extension the asset pages work against, so the
 * `(token as any)` casts that used to be scattered everywhere are gone.
 */
export type AssetToken = ApiToken & {
  balances?: Array<{ owner: string; amount: string }> | null;
  isHidden?: boolean;
};

type AssetAttribute = { trait_type?: string; value?: string };

/** Hidden colour-extraction image + full-bleed blurred backdrop, shared by every asset page. */
export function AssetAtmosphere({
  imageUrl,
  imgRef,
  // Backdrop alpha. Standard (single IP asset) pages use the balanced
  // `opacity-30` (matches medialane-io); pop/drop/edition keep `opacity-20`.
  opacityClassName = "opacity-20",
}: {
  imageUrl: string | null;
  imgRef: React.RefObject<HTMLImageElement>;
  opacityClassName?: string;
}) {
  if (!imageUrl) return null;
  return (
    <>
      <Image
        ref={imgRef}
        src={imageUrl}
        crossOrigin="anonymous"
        aria-hidden
        alt=""
        width={1}
        height={1}
        fetchPriority="high"
        unoptimized
        style={{ display: "none" }}
      />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <Image
          src={imageUrl}
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          className={`absolute inset-0 w-full h-full object-cover scale-110 ${opacityClassName}`}
          style={{ filter: "blur(60px) saturate(1.5)" }}
          unoptimized
        />
      </div>
    </>
  );
}

/**
 * Derives the listing/bid/ownership and metadata state shared by the edition,
 * standard, and drop asset pages. Safe to call before the token has loaded.
 */
export function useAssetMarketState(
  token: AssetToken | null,
  listings: ApiOrder[],
  walletAddress: string | null | undefined,
) {
  return useMemo(() => {
    // Listings = NFT in offer (someone selling); bids = ERC20 in offer (someone buying).
    const activeListings = listings.filter(
      (l) => l.status === "ACTIVE" && (l.offer.itemType === "ERC721" || l.offer.itemType === "ERC1155")
    );
    const activeBids = listings.filter(
      (l) => l.status === "ACTIVE" && l.offer.itemType === "ERC20"
    );
    const cheapest = [...activeListings].sort((a, b) =>
      BigInt(a.consideration.startAmount) < BigInt(b.consideration.startAmount) ? -1 : 1
    )[0];

    const isOwner = checkIsOwner(token, walletAddress);
    const myListing = isOwner && walletAddress
      ? activeListings.find((l) => l.offerer.toLowerCase() === walletAddress.toLowerCase()) ?? null
      : null;

    const attributes: AssetAttribute[] = Array.isArray(token?.metadata?.attributes)
      ? (token!.metadata!.attributes as AssetAttribute[])
      : [];

    // Per-type keys avoid cross-type collisions from shared keys like "Genre", "Duration".
    const activeTemplate = IP_TEMPLATES[
      (attributes.find((a) => a.trait_type?.toLowerCase() === "ip type")?.value ?? "") as IPType
    ];
    // Keys rendered by IPTypeDisplay (embeds + socials) are kept out of the
    // generic attribute grid; trait values fall through to it.
    const activeTemplateEmbedSocialKeys = activeTemplate
      ? [
          ...(activeTemplate.embeds ?? []).map((p) => EMBED_PLATFORM_META[p].traitKey),
          ...(activeTemplate.socials ?? []).map((p) => SOCIAL_PLATFORM_META[p].traitKey),
        ]
      : [];
    const activeTemplateKeys = new Set<string>(["IP Type", ...activeTemplateEmbedSocialKeys]);
    const hasTemplateData = activeTemplateEmbedSocialKeys.some((k) =>
      attributes.some((a) => a.trait_type === k && a.value)
    );
    const isDisplayAttr = (a: AssetAttribute): boolean =>
      !LICENSE_TRAIT_TYPES.has(a.trait_type ?? "") && !activeTemplateKeys.has(a.trait_type ?? "");

    const parentContract = attributes.find((a) => a.trait_type === "Parent Contract")?.value ?? null;
    const parentTokenId = attributes.find((a) => a.trait_type === "Parent Token ID")?.value ?? null;

    return {
      activeListings,
      activeBids,
      cheapest,
      isOwner,
      myListing,
      attributes,
      hasTemplateData,
      isDisplayAttr,
      parentContract,
      parentTokenId,
    };
  }, [token, listings, walletAddress]);
}
