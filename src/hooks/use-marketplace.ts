import { useState, useCallback } from "react";
import { useContract, useProvider } from "@starknet-react/core";
import { Abi, num } from "starknet";
import { useSWRConfig } from "swr";
import { IPMarketplaceABI, Medialane1155ABI as IPMarketplace1155ABI } from "@medialane/sdk/starknet";
import { toast } from "sonner";
import { rewardToast } from "@/lib/reward-toast";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { dappFeeConfig, buildFeeCall } from "@/lib/fee";
import type { CheckoutItem } from "@/lib/checkout";
import { getStarknetVenue } from "@/lib/starknet-venue";
import { useVenueSigner } from "@/lib/use-venue-signer";
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
        tokenStandard?: string
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
    const withProcessing = useCallback(async <T>(
        fn: () => Promise<T>
    ): Promise<T | undefined> => {
        setIsProcessing(true);
        setError(null);
        try {
            return await fn();
        } catch (err: any) {
            console.error("[marketplace] error:", JSON.stringify(err, null, 2), err);
            const friendly = getFriendlyWalletError(err);
            setError(friendly.message);
            if (friendly.isUserRejection) {
                toast.info(friendly.title, { description: friendly.description });
            } else {
                toast.error(friendly.title, { description: friendly.message });
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
        return withProcessing(async () => {
            const royaltyMaxBps = await resolveRoyaltyMaxBps(assetContractAddress, tokenId);
            const now = Math.floor(Date.now() / 1000);
            const { txHash: hash } = await venue.registerOrder(signer, {
                asset: { chain: "STARKNET", contract: assetContractAddress, tokenId },
                side: "listing",
                paymentToken: currencySymbol,
                amount: toWei(price, currencySymbol), // per-unit raw base units
                quantity: is1155 ? (amount ?? "1") : "1",
                royaltyMaxBps,
                startTime: 0,
                endTime: now + durationSeconds,
                salt: generateSalt(),
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
        });
    }, [signer, venue, withProcessing, resolveRoyaltyMaxBps, refreshMarketplaceCaches]);

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
        const is1155 = tokenStandard === "ERC1155";
        return withProcessing(async () => {
            const royaltyMaxBps = await resolveRoyaltyMaxBps(assetContractAddress, tokenId);
            const now = Math.floor(Date.now() / 1000);
            const { txHash: hash } = await venue.registerOrder(signer, {
                asset: { chain: "STARKNET", contract: assetContractAddress, tokenId },
                side: "bid",
                paymentToken: currencySymbol,
                // Per-unit bid price; the venue approves per-unit × quantity for 1155.
                amount: toWei(price, currencySymbol),
                quantity: is1155 ? "1" : "1",
                royaltyMaxBps,
                startTime: 0,
                endTime: now + durationSeconds,
                salt: generateSalt(),
            });
            setTxHash(hash);
            refreshMarketplaceCaches();
            if (!opts?.silent) toast.success("Offer Placed", { description: "Your offer has been submitted and is now live." });
            rewardToast("make_offer");
            return hash;
        });
    }, [signer, venue, withProcessing, resolveRoyaltyMaxBps, refreshMarketplaceCaches]);

    const checkoutCart = useCallback(async (items: CheckoutItem[], opts?: WriteOpts) => {
        if (!signer) {
            toast.error("Connect your wallet first");
            return undefined;
        }
        if (!medialaneContract || items.length === 0) {
            const msg = "Contract not available, or cart empty";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            // Group required ERC20 approvals by token address, split by standard
            const tokenTotals721 = new Map<string, bigint>();
            const tokenTotals1155 = new Map<string, bigint>();
            items.forEach((item) => {
                const token = item.considerationToken;
                const amt = BigInt(item.considerationAmount);
                if (item.isERC1155) {
                    tokenTotals1155.set(token, (tokenTotals1155.get(token) || 0n) + amt);
                } else {
                    tokenTotals721.set(token, (tokenTotals721.get(token) || 0n) + amt);
                }
            });

            const { cairo } = await import("starknet");
            const approveCalls721 = Array.from(tokenTotals721.entries()).map(([token, totalWei]) => {
                const amountUint256 = cairo.uint256(totalWei.toString());
                return {
                    contractAddress: token,
                    entrypoint: "approve",
                    calldata: [medialaneContract.address, amountUint256.low.toString(), amountUint256.high.toString()],
                };
            });
            const approveCalls1155 = Array.from(tokenTotals1155.entries()).map(([token, totalWei]) => {
                const amountUint256 = cairo.uint256(totalWei.toString());
                return {
                    contractAddress: token,
                    entrypoint: "approve",
                    calldata: [medialane1155Contract!.address, amountUint256.low.toString(), amountUint256.high.toString()],
                };
            });

            // Fulfilment is unsigned in 0.26.0 — the caller IS the fulfiller, so no
            // per-item SNIP-12 signature (and no nonce) is needed. fulfill_order takes
            // the order hash (+ quantity for ERC-1155).
            const fulfillCalls: any[] = items.map((item) =>
                item.isERC1155
                    ? medialane1155Contract!.populate("fulfill_order", [item.orderHash, item.quantity ?? "1"])
                    : medialaneContract.populate("fulfill_order", [item.orderHash])
            );

            toast.info("Executing Purchase", { description: "Approve the final transaction to sweep the cart." });

            // Platform fee (creators fund) — one transfer per token, summed.
            const feeCalls = [...tokenTotals721.entries(), ...tokenTotals1155.entries()]
                .map(([token, totalWei]) =>
                    buildFeeCall(
                        { surface: "marketplace", token, grossAmount: totalWei },
                        dappFeeConfig
                    )
                )
                .filter((c): c is NonNullable<typeof c> => c !== null);

            // Single atomic multicall: all approvals + all fulfillments + fee transfers
            const { txHash: hash } = await signer.execute([...approveCalls721, ...approveCalls1155, ...fulfillCalls, ...feeCalls]);
            setTxHash(hash);
            refreshMarketplaceCaches();
            if (!opts?.silent) toast.success("Purchase Successful", { description: `Successfully purchased ${items.length} item(s).` });
            rewardToast("buy_asset");
            return hash;
        });
    }, [signer, medialaneContract, medialane1155Contract, withProcessing, refreshMarketplaceCaches]);

    const cancelOrder = useCallback(async (orderHash: string, _tokenStandard?: string, kind: "listing" | "offer" = "listing", opts?: WriteOpts) => {
        if (!signer) {
            toast.error("Connect your wallet first");
            return undefined;
        }
        return withProcessing(async () => {
            const { txHash: hash } = await venue.cancelOrder(signer, orderHash);
            setTxHash(hash);
            refreshMarketplaceCaches();
            if (!opts?.silent) {
                toast.success(
                    kind === "offer" ? "Offer Cancelled" : "Listing Cancelled",
                    { description: `The ${kind} has been successfully cancelled on-chain.` }
                );
            }
            return hash;
        });
    }, [signer, venue, withProcessing, refreshMarketplaceCaches]);

    /**
     * Asset owner accepts an incoming bid. Fulfilment is unsigned (the owner is
     * the fulfiller); the owner approves the NFT transfer to the marketplace, then
     * executes both calls atomically. Kept app-side because the venue's fulfil
     * models a buyer paying, not a seller approving their NFT.
     */
    const acceptOffer = useCallback(async (
        orderHash: string,
        nftContractAddress: string,
        tokenId: string,
        tokenStandard?: string
    ) => {
        if (!signer) {
            toast.error("Connect your wallet first");
            return undefined;
        }
        const is1155 = tokenStandard === "ERC1155";
        const contract = is1155 ? medialane1155Contract : medialaneContract;
        if (!contract) {
            const msg = "Contract not available";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            const fulfillCall = is1155
                ? contract.populate("fulfill_order", [orderHash, "1"])
                : contract.populate("fulfill_order", [orderHash]);

            const { cairo } = await import("starknet");
            let approveCall: any;
            if (is1155) {
                approveCall = {
                    contractAddress: nftContractAddress,
                    entrypoint: "set_approval_for_all",
                    calldata: [contract.address, "1"],
                };
            } else {
                const tokenIdUint256 = cairo.uint256(tokenId);
                approveCall = {
                    contractAddress: nftContractAddress,
                    entrypoint: "approve",
                    calldata: [contract.address, tokenIdUint256.low.toString(), tokenIdUint256.high.toString()],
                };
            }

            const { txHash: hash } = await signer.execute([approveCall, fulfillCall]);
            setTxHash(hash);
            refreshMarketplaceCaches();
            rewardToast("offer_accepted_seller");
            return hash;
        });
    }, [signer, medialaneContract, medialane1155Contract, withProcessing, refreshMarketplaceCaches]);

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
