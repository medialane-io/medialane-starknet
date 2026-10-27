import { useCallback } from "react";
import { getTokenBySymbol, type ApiIntentCreated, type IntentCall } from "@medialane/sdk";
import { useMedialaneClient } from "@medialane/ui";
import type { CheckoutItem } from "@/lib/checkout";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { useWriteState } from "@/hooks/use-write-state";
import { invalidateMarketplace } from "@/lib/cache";
import { executeIntent, executeIntents } from "@medialane/sdk/starknet";

interface UseMarketplaceReturn {
    createListing: (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string,
        amount?: string
    ) => Promise<string | undefined>;
    makeOffer: (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string
    ) => Promise<string | undefined>;
    checkoutCart: (items: CheckoutItem[], swap?: ApiIntentCreated) => Promise<string | undefined>;
    cancelOrder: (orderHash: string, tokenStandard?: string) => Promise<string | undefined>;
    acceptOffer: (orderHash: string, tokenStandard?: string) => Promise<string | undefined>;

    isProcessing: boolean;
    isConfirmed: boolean;
    isTerminalError: boolean;
    txHash: string | null;
    error: string | null;
    resetState: () => void;
}

const asTokenStandard = (value?: string): "ERC721" | "ERC1155" | undefined =>
    value === "ERC721" || value === "ERC1155" ? value : undefined;

export function useMarketplace(): UseMarketplaceReturn {
    const signer = useVenueSigner();
    const client = useMedialaneClient();
    const { isProcessing, isConfirmed, isTerminalError, txHash, setTxHash, error, setError, run, resetState } = useWriteState();

    const submitSigned = useCallback(async (intent: ApiIntentCreated): Promise<string> => {
        if (!signer) throw new Error("Connect your wallet to continue.");
        const { txHash: hash } = await executeIntent(signer, client, intent);
        setTxHash(hash);
        invalidateMarketplace();
        return hash;
    }, [signer, client, setTxHash]);

    const createListing = useCallback(async (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string,
        amount?: string
    ) => {
        if (!signer) {
            setError("Connect your wallet to continue.");
            return undefined;
        }
        const token = getTokenBySymbol(currencySymbol);
        if (!token) {
            setError(`${currencySymbol} is not a currency this marketplace accepts.`);
            return undefined;
        }
        return run(async () => {
            const now = Math.floor(Date.now() / 1000);
            const intentRes = await client.api.intents.create("listing", {
                offerer: signer.address,
                nftContract: assetContractAddress,
                tokenId,
                currency: token.address,
                price,
                endTime: now + durationSeconds,
                amount: tokenStandard === "ERC1155" ? (amount ?? "1") : undefined,
            });
            if (!intentRes.requiresSignature) throw new Error("Expected a signature-required listing intent");
            return submitSigned(intentRes);
        });
    }, [signer, client, setError, run, submitSigned]);

    const makeOffer = useCallback(async (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string
    ) => {
        if (!signer) {
            setError("Connect your wallet to continue.");
            return undefined;
        }
        const token = getTokenBySymbol(currencySymbol);
        if (!token) {
            setError(`${currencySymbol} is not a currency this marketplace accepts.`);
            return undefined;
        }
        return run(async () => {
            const now = Math.floor(Date.now() / 1000);
            const intentRes = await client.api.intents.create("offer", {
                offerer: signer.address,
                nftContract: assetContractAddress,
                tokenId,
                currency: token.address,
                price,
                endTime: now + durationSeconds,
                tokenStandard: asTokenStandard(tokenStandard),
            });
            if (!intentRes.requiresSignature) throw new Error("Expected a signature-required offer intent");
            return submitSigned(intentRes);
        });
    }, [signer, client, setError, run, submitSigned]);

    const checkoutCart = useCallback(async (items: CheckoutItem[], swap?: ApiIntentCreated) => {
        if (!signer) {
            setError("Connect your wallet to continue.");
            return undefined;
        }
        if (items.length === 0) {
            setError("Your cart is empty.");
            return undefined;
        }

        return run(async () => {
            const checkoutRes = await client.api.intents.checkout({
                fulfiller: signer.address,
                items: items.map((i) => ({ orderHash: i.orderHash, quantity: i.quantity })),
            });
            const failed = checkoutRes.filter((r) => r.error);
            if (failed.length > 0) {
                throw new Error(`${failed.length} item(s) could not be prepared: ${failed.map((f) => f.error).join("; ")}`);
            }
            const prepared = checkoutRes.map((r): ApiIntentCreated => ({
                id: r.id!,
                expiresAt: r.expiresAt ?? "",
                requiresSignature: false,
                calls: (r.calls as IntentCall[]) ?? [],
            }));
            const { txHash: hash } = await executeIntents(signer, client, swap ? [swap, ...prepared] : prepared);
            setTxHash(hash);
            invalidateMarketplace();
            return hash;
        });
    }, [signer, client, setError, setTxHash, run]);

    const cancelOrder = useCallback(async (orderHash: string, tokenStandard?: string) => {
        if (!signer) {
            setError("Connect your wallet to continue.");
            return undefined;
        }
        return run(async () => {
            const intentRes = await client.api.intents.create("cancel", {
                offerer: signer.address,
                orderHash,
                tokenStandard: asTokenStandard(tokenStandard),
            });
            if (!intentRes.requiresSignature) throw new Error("Expected a signature-required cancel intent");
            return submitSigned(intentRes);
        });
    }, [signer, client, setError, run, submitSigned]);

    const acceptOffer = useCallback(async (orderHash: string, tokenStandard?: string) => {
        if (!signer) {
            setError("Connect your wallet to continue.");
            return undefined;
        }
        return run(async () => {
            const intentRes = await client.api.intents.create("fulfill", {
                fulfiller: signer.address,
                orderHash,
                tokenStandard: asTokenStandard(tokenStandard),
            });
            if (intentRes.requiresSignature) throw new Error("Expected a prebuilt fulfill intent");
            return submitSigned(intentRes);
        });
    }, [signer, client, setError, run, submitSigned]);

    return {
        createListing,
        makeOffer,
        checkoutCart,
        cancelOrder,
        acceptOffer,
        isProcessing,
        isConfirmed,
        isTerminalError,
        txHash,
        error,
        resetState,
    };
}
