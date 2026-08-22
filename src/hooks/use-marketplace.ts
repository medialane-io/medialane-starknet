import { useState, useCallback } from "react";
import type { Call, TypedData } from "starknet";
import { useSWRConfig } from "swr";
import { getTokenBySymbol } from "@medialane/sdk";
import { toast } from "sonner";
import { rewardToast } from "@/lib/reward-toast";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { feeConfig, buildFeeCall } from "@/lib/fee";
import type { CheckoutItem } from "@/lib/checkout";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { signAndExecuteIntent, executePrebuiltIntent } from "@/lib/intent-tx";
import { useMedialaneClient } from "@/hooks/use-medialane-client";
import { resetMarketplaceDebug, markMarketplaceDebug, getMarketplaceDebugText } from "@/lib/marketplace-debug";
import { INDEXER_REVALIDATION_DELAY_MS } from "@/lib/constants";

interface WriteOpts {
    silent?: boolean;

    swapCalls?: Call[];
}

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
    isLoading: boolean;
    txHash: string | null;
    error: string | null;
    resetState: () => void;
}

export function useMarketplace(): UseMarketplaceReturn {
    const signer = useVenueSigner();
    const client = useMedialaneClient();
    const { mutate } = useSWRConfig();

    const [isProcessing, setIsProcessing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resetState = useCallback(() => {
        setTxHash(null);
        setError(null);
        setIsProcessing(false);
    }, []);

    const invalidateMarketplaceCaches = useCallback(() => {

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
    }, []);

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
                price,
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

            const tokenTotals = new Map<string, bigint>();
            items.forEach((item) => {
                const amt = BigInt(item.considerationAmount);
                tokenTotals.set(item.considerationToken, (tokenTotals.get(item.considerationToken) || 0n) + amt);
            });
            const feeCalls = Array.from(tokenTotals.entries())
                .map(([token, grossAmount]) => buildFeeCall({ surface: "marketplace", token, grossAmount }, feeConfig))
                .filter((c): c is NonNullable<typeof c> => c !== null);

            toast.info("Executing Purchase", { description: "Approve the final transaction to sweep the cart." });

            const { txHash: hash } = await signer.execute([
                ...(opts?.swapCalls ?? []),
                ...fulfillCalls,
                ...feeCalls,
            ]);

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
