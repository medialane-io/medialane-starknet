import { useState, useCallback } from "react";
import { useContract, useProvider } from "@starknet-react/core";
import { Abi, num, type Call, type TypedData } from "starknet";
import { useSWRConfig } from "swr";
import { IPMarketplaceABI, Medialane1155ABI as IPMarketplace1155ABI } from "@medialane/sdk/starknet";
import { getTokenBySymbol } from "@medialane/sdk";
import { toast } from "sonner";
import { rewardToast } from "@/lib/reward-toast";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { dappFeeConfig, buildFeeCall } from "@/lib/fee";
import type { CheckoutItem } from "@/lib/checkout";
import { getStarknetVenue } from "@/lib/starknet-venue";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { signAndExecuteIntent, executePrebuiltIntent } from "@/lib/intent-tx";
import { useMedialaneClient } from "@/hooks/use-medialane-client";
import { resetMarketplaceDebug, markMarketplaceDebug, getMarketplaceDebugText } from "@/lib/marketplace-debug";
import {
    SUPPORTED_TOKENS,
    STARKNET_MARKETPLACE_721_CONTRACT,
    STARKNET_MARKETPLACE_1155_CONTRACT,
    INDEXER_REVALIDATION_DELAY_MS,
} from "@/lib/constants";

/**
 * Per-call options for marketplace write ops. `silent` suppresses the success
 * toast — passed by dialog callers that render their own inline success state,
 * so the user doesn't get a dialog AND a toast. Direct callers (portfolio
 * tables/grids, which have no dialog) omit it and keep the toast.
 */
interface WriteOpts { silent?: boolean }

interface UseMarketplaceReturn {
    createListing: (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string,
        amount?: string,
        opts?: WriteOpts
    ) => Promise<string | undefined>;
    makeOffer: (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string,
        opts?: WriteOpts
    ) => Promise<string | undefined>;
    checkoutCart: (items: CheckoutItem[], opts?: WriteOpts) => Promise<string | undefined>;
    cancelOrder: (orderHash: string, tokenStandard?: string, kind?: "listing" | "offer", opts?: WriteOpts) => Promise<string | undefined>;
    cancelListing: (orderHash: string, tokenStandard?: string, kind?: "listing" | "offer", opts?: WriteOpts) => Promise<string | undefined>;
    acceptOffer: (
        orderHash: string,
        nftContractAddress: string,
        tokenId: string,
        tokenStandard?: string,
        opts?: WriteOpts
    ) => Promise<string | undefined>;

    isProcessing: boolean;
    isLoading: boolean; // For compatibility
    txHash: string | null;
    error: string | null;
    resetState: () => void;
}

// Module-level helpers
const getDecimals = (currencySymbol: string) =>
    SUPPORTED_TOKENS.find((t) => t.symbol === currencySymbol)?.decimals ?? 18;

const toWei = (price: string, currencySymbol: string): string =>
    BigInt(Math.floor(parseFloat(price) * Math.pow(10, getDecimals(currencySymbol)))).toString();

// Full-felt (248-bit) random salt — the SOLE order-hash uniqueness source in the
// 0.26.0 schema (nonce removed). Mirrors @medialane/sdk generateSalt.
const generateSalt = (): string => {
    const bytes = new Uint8Array(31);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return num.toHex(BigInt("0x" + hex));
};

/**
 * Marketplace write hook. The signed order-construction (list / offer / cancel)
 * runs through the chain-neutral `StarknetVenue` adapter — the app no longer
 * hand-rolls SNIP-12 signing or `register_order` calldata. Fulfilment stays here
 * as app-level composition: `checkoutCart` is a multi-item atomic sweep and
 * `acceptOffer` is a seller-side fulfil (NFT approval, not payment) — neither of
 * which the single-order `VenueAdapter` models — but both execute through the
 * shared `useVenueSigner` port, so wallet selection + confirmation are unified.
 */
export function useMarketplace(): UseMarketplaceReturn {
    const venue = getStarknetVenue();
    const signer = useVenueSigner();
    const { provider } = useProvider();
    const client = useMedialaneClient();
    const { mutate } = useSWRConfig();

    const [isProcessing, setIsProcessing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { contract: medialaneContract } = useContract({
        address: STARKNET_MARKETPLACE_721_CONTRACT as `0x${string}`,
        abi: IPMarketplaceABI as unknown as Abi,
    });
    const { contract: medialane1155Contract } = useContract({
        address: STARKNET_MARKETPLACE_1155_CONTRACT as `0x${string}`,
        abi: IPMarketplace1155ABI as unknown as Abi,
    });

    const resetState = useCallback(() => {
        setTxHash(null);
        setError(null);
        setIsProcessing(false);
    }, []);

    const invalidateMarketplaceCaches = useCallback(() => {
        // Revalidate matching keys WITHOUT clearing their cached data. Passing
        // `undefined` as mutate's data arg wipes the cache — and since the asset
        // page's `token-<contract>-<id>` key matches this filter, wiping it flips
        // `useToken().isLoading` true, which unmounts the asset variant (and any
        // open marketplace dialog) into the skeleton branch — destroying the
        // success dialog mid-flow so only the toast survives. Filter-only mutate
        // re-fetches in the background while keeping the variant mounted.
        mutate(
            (key) => {
                if (typeof key !== "string") return false;
                if (key.startsWith("listings-")) return true;
                if (key.startsWith("user-orders-")) return true;
                if (key.startsWith("order-")) return true;
                if (key.startsWith("tokens-owned-")) return true;
                if (key.startsWith("token-")) return true;
                if (key.startsWith("counter-offers-")) return true;
                if (key.startsWith("floor-listings-")) return true;
                if (key.startsWith("tokens-by-type-")) return true;
                return key.includes('"op":"orders"');
            }
        );
    }, [mutate]);

    const refreshMarketplaceCaches = useCallback(() => {
        invalidateMarketplaceCaches();
        window.setTimeout(invalidateMarketplaceCaches, INDEXER_REVALIDATION_DELAY_MS);
    }, [invalidateMarketplaceCaches]);

    // Wraps an async operation with isProcessing state and unified error handling.
    // `op` seeds a fresh breadcrumb trail (src/lib/marketplace-debug.ts, logged live
    // via console.debug at each step in use-venue-signer.ts) so a hang with no
    // thrown error (isProcessing never resolves) is still diagnosable from the
    // console alone — the last "[marketplace-debug]" line is where it got stuck.
    //
    // `opts.silent` suppresses the error toast too (not just success, below) —
    // every dialog caller already renders `error` inline via its own <Alert>, so
    // firing a toast on top duplicated the same message twice. Direct callers
    // with no dialog (portfolio tables/grids) omit `opts` and keep the toast as
    // their only feedback surface.
    const withProcessing = useCallback(async <T>(
        op: string,
        fn: () => Promise<T>,
        opts?: WriteOpts
    ): Promise<T | undefined> => {
        resetMarketplaceDebug(op);
        setIsProcessing(true);
        setError(null);
        try {
            const result = await fn();
            markMarketplaceDebug(`${op}: done`);
            return result;
        } catch (err) {
            markMarketplaceDebug(`${op}: threw`);
            console.error("[marketplace] error:", getMarketplaceDebugText({ error: err }));
            const friendly = getFriendlyWalletError(err);
            setError(friendly.message);
            if (!opts?.silent) {
                if (friendly.isUserRejection) {
                    toast.info(friendly.title, { description: friendly.description });
                } else {
                    toast.error(friendly.title, { description: friendly.message });
                }
            }
            return undefined;
        } finally {
            setIsProcessing(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Signed EIP-2981 royalty cap (bps) for an order. Reads the NFT's live 2981
    // rate via royalty_info(tokenId, 10000) — the returned amount equals the bps
    // at salePrice 10000. Non-2981 NFTs / failures yield 0 (never over-pay). The
    // venue accepts this as the royalty_max_bps override (skipping its own read).
    const resolveRoyaltyMaxBps = useCallback(async (
        nft: string,
        tokenId: string
    ): Promise<number> => {
        try {
            const { cairo } = await import("starknet");
            const id = cairo.uint256(tokenId);
            const res = await provider.callContract({
                contractAddress: nft,
                entrypoint: "royalty_info",
                calldata: [id.low.toString(), id.high.toString(), "10000", "0"],
            });
            return Number(BigInt(res[1] ?? "0"));
        } catch {
            return 0;
        }
    }, [provider]);

    const createListing = useCallback(async (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string,
        amount?: string,
        opts?: WriteOpts
    ) => {
        if (!signer) {
            toast.error("Connect your wallet first");
            return undefined;
        }
        const is1155 = tokenStandard === "ERC1155";
        const token = getTokenBySymbol(currencySymbol);
        if (!token) {
            toast.error(`Unsupported currency: ${currencySymbol}`);
            return undefined;
        }
        return withProcessing("createListing", async () => {
            const now = Math.floor(Date.now() / 1000);
            const intentRes = await client.api.createListingIntent({
                offerer: signer.address,
                nftContract: assetContractAddress,
                tokenId,
                currency: token.address,
                price, // human-readable — the backend converts via the token's decimals
                endTime: now + durationSeconds,
                amount: is1155 ? (amount ?? "1") : undefined,
            });
            if (!intentRes.data.requiresSignature) throw new Error("Expected a signature-required listing intent");
            const { txHash: hash } = await signAndExecuteIntent(signer, client, {
                id: intentRes.data.id,
                typedData: intentRes.data.typedData as TypedData,
            });
            setTxHash(hash);
            refreshMarketplaceCaches();
            if (!opts?.silent) {
                toast.success("Listing Created", {
                    description: is1155 ? "Your edition has been listed successfully." : "Your asset has been listed successfully.",
                });
            }
            rewardToast("list_asset");
            return hash;
        }, opts);
    }, [signer, client, withProcessing, refreshMarketplaceCaches]);

    const makeOffer = useCallback(async (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string,
        opts?: WriteOpts
    ) => {
        if (!signer) {
            toast.error("Connect your wallet first");
            return undefined;
        }
        const token = getTokenBySymbol(currencySymbol);
        if (!token) {
            toast.error(`Unsupported currency: ${currencySymbol}`);
            return undefined;
        }
        return withProcessing("makeOffer", async () => {
            const now = Math.floor(Date.now() / 1000);
            const intentRes = await client.api.createOfferIntent({
                offerer: signer.address,
                nftContract: assetContractAddress,
                tokenId,
                currency: token.address,
                price,
                endTime: now + durationSeconds,
                tokenStandard,
            });
            if (!intentRes.data.requiresSignature) throw new Error("Expected a signature-required offer intent");
            const { txHash: hash } = await signAndExecuteIntent(signer, client, {
                id: intentRes.data.id,
                typedData: intentRes.data.typedData as TypedData,
            });
            setTxHash(hash);
            refreshMarketplaceCaches();
            if (!opts?.silent) toast.success("Offer Placed", { description: "Your offer has been submitted and is now live." });
            rewardToast("make_offer");
            return hash;
        }, opts);
    }, [signer, client, withProcessing, refreshMarketplaceCaches]);

    const checkoutCart = useCallback(async (items: CheckoutItem[], opts?: WriteOpts) => {
        if (!signer) {
            toast.error("Connect your wallet first");
            return undefined;
        }
        if (items.length === 0) {
            const msg = "Cart empty";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing("checkoutCart", async () => {
            const checkoutRes = await client.api.createCheckoutIntent({
                fulfiller: signer.address,
                orderHashes: items.map((i) => i.orderHash),
            });
            const failed = checkoutRes.data.filter((r) => r.error);
            if (failed.length > 0) {
                throw new Error(`${failed.length} item(s) could not be prepared: ${failed.map((f) => f.error).join("; ")}`);
            }
            const fulfillCalls = checkoutRes.data.flatMap((r) => (r.calls as Call[]) ?? []);

            // Platform fee (creators fund) — one transfer per token, summed. Stays
            // app-side: 02-protocol-app-split.md §II, fee is added to the quote
            // before signing, never computed by the backend.
            const tokenTotals = new Map<string, bigint>();
            items.forEach((item) => {
                const amt = BigInt(item.considerationAmount);
                tokenTotals.set(item.considerationToken, (tokenTotals.get(item.considerationToken) || 0n) + amt);
            });
            const feeCalls = Array.from(tokenTotals.entries())
                .map(([token, grossAmount]) => buildFeeCall({ surface: "marketplace", token, grossAmount }, dappFeeConfig))
                .filter((c): c is NonNullable<typeof c> => c !== null);

            toast.info("Executing Purchase", { description: "Approve the final transaction to sweep the cart." });

            const { txHash: hash } = await signer.execute([...fulfillCalls, ...feeCalls]);
            // Best-effort per-item confirm — a failure here doesn't affect the tx.
            await Promise.all(
                checkoutRes.data.map((r) => (r.id ? client.api.confirmIntent(r.id, hash).catch(() => {}) : Promise.resolve()))
            );
            setTxHash(hash);
            refreshMarketplaceCaches();
            if (!opts?.silent) toast.success("Purchase Successful", { description: `Successfully purchased ${items.length} item(s).` });
            rewardToast("buy_asset");
            return hash;
        }, opts);
    }, [signer, client, withProcessing, refreshMarketplaceCaches]);

    const cancelOrder = useCallback(async (orderHash: string, tokenStandard?: string, kind: "listing" | "offer" = "listing", opts?: WriteOpts) => {
        if (!signer) {
            toast.error("Connect your wallet first");
            return undefined;
        }
        return withProcessing("cancelOrder", async () => {
            const intentRes = await client.api.createCancelIntent({
                offerer: signer.address,
                orderHash,
                tokenStandard,
            });
            if (!intentRes.data.requiresSignature) throw new Error("Expected a signature-required cancel intent");
            const { txHash: hash } = await signAndExecuteIntent(signer, client, {
                id: intentRes.data.id,
                typedData: intentRes.data.typedData as TypedData,
            });
            setTxHash(hash);
            refreshMarketplaceCaches();
            if (!opts?.silent) {
                toast.success(
                    kind === "offer" ? "Offer Cancelled" : "Listing Cancelled",
                    { description: `The ${kind} has been successfully cancelled on-chain.` }
                );
            }
            return hash;
        }, opts);
    }, [signer, client, withProcessing, refreshMarketplaceCaches]);

    /**
     * Asset owner accepts an incoming bid. Fulfilment is unsigned (the owner is
     * the fulfiller); the owner approves the NFT transfer to the marketplace, then
     * executes both calls atomically. Kept app-side because the venue's fulfil
     * models a buyer paying, not a seller approving their NFT.
     */
    const acceptOffer = useCallback(async (
        orderHash: string,
        _nftContractAddress: string,
        _tokenId: string,
        tokenStandard?: string,
        opts?: WriteOpts
    ) => {
        if (!signer) {
            toast.error("Connect your wallet first");
            return undefined;
        }
        return withProcessing("acceptOffer", async () => {
            const intentRes = await client.api.createFulfillIntent({
                fulfiller: signer.address,
                orderHash,
                tokenStandard,
            });
            if (intentRes.data.requiresSignature) throw new Error("Expected a prebuilt fulfill intent");
            const { txHash: hash } = await executePrebuiltIntent(signer, client, {
                id: intentRes.data.id,
                calls: intentRes.data.calls as Call[],
            });
            setTxHash(hash);
            refreshMarketplaceCaches();
            rewardToast("offer_accepted_seller");
            return hash;
        }, opts);
    }, [signer, client, withProcessing, refreshMarketplaceCaches]);

    return {
        createListing,
        makeOffer,
        checkoutCart,
        cancelOrder,
        cancelListing: cancelOrder,
        acceptOffer,
        isProcessing,
        isLoading: isProcessing,
        txHash,
        error,
        resetState,
    };
}
