import { useState, useCallback } from "react";
import { useAccount, useContract, useNetwork, useProvider } from "@starknet-react/core";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { Abi, shortString, constants } from "starknet";
import { useSWRConfig } from "swr";
import { IPMarketplaceABI } from "@/abis/ip_market";
import { IPMarketplace1155ABI } from "@/abis/ip_market_1155";
import { toast } from "sonner";
import {
    getOrderParametersTypedData,
    getOrderCancellationTypedData,
    getOrderFulfillmentTypedData,
    get1155OrderParametersTypedData,
    get1155OrderFulfillmentTypedData,
    get1155OrderCancellationTypedData,
    stringifyBigInts,
} from "@/utils/marketplace-utils";

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
    checkoutCart: (items: any[]) => Promise<string | undefined>;
    cancelOrder: (orderHash: string, tokenStandard?: string) => Promise<string | undefined>;
    cancelListing: (orderHash: string, tokenStandard?: string) => Promise<string | undefined>;
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
import { SUPPORTED_TOKENS, MARKETPLACE_721_CONTRACT, MARKETPLACE_1155_CONTRACT, INDEXER_REVALIDATION_DELAY_MS } from "@/lib/constants";
const getDecimals = (currencySymbol: string) =>
    SUPPORTED_TOKENS.find((t) => t.symbol === currencySymbol)?.decimals ?? 18;

const toWei = (price: string, currencySymbol: string): string =>
    BigInt(Math.floor(parseFloat(price) * Math.pow(10, getDecimals(currencySymbol)))).toString();

const ORDER_CREATED_SELECTOR = "0x3427759bfd3b941f14e687e129519da3c9b0046c5b9aaa290bb1dede63753b3";

const sameAddress = (a?: string, b?: string) => {
    if (!a || !b) return false;
    try {
        return BigInt(a).toString() === BigInt(b).toString();
    } catch {
        return a.toLowerCase() === b.toLowerCase();
    }
};

const assertTransactionSucceeded = (receipt: any) => {
    if (receipt?.execution_status === "REVERTED") {
        throw new Error(receipt.revert_reason || "Transaction reverted on-chain. Check the explorer for details.");
    }
};

const assertOrderCreated = (receipt: any, marketplaceAddress: string) => {
    const events = Array.isArray(receipt?.events) ? receipt.events : [];
    const hasOrderCreated = events.some((event: any) =>
        sameAddress(event?.from_address, marketplaceAddress) &&
        Array.isArray(event?.keys) &&
        event.keys[0] === ORDER_CREATED_SELECTOR
    );

    if (!hasOrderCreated) {
        throw new Error("Transaction confirmed, but the marketplace did not emit an order-created event.");
    }
};

export function useMarketplace(): UseMarketplaceReturn {
    const { account } = useAccount();
    const { chain } = useNetwork();
    const { provider } = useProvider();
    const { mutate } = useSWRConfig();

    const [isProcessing, setIsProcessing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { contract: medialaneContract } = useContract({
        address: MARKETPLACE_721_CONTRACT,
        abi: IPMarketplaceABI as any[],
    });
    const { contract: medialane1155Contract } = useContract({
        address: MARKETPLACE_1155_CONTRACT,
        abi: IPMarketplace1155ABI as any[],
    });
    const { address: walletAddress } = useUnifiedWallet();

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
            },
            undefined,
            { revalidate: true }
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
            const msg = err?.message || (err?.code ? `Wallet error ${err.code}` : "An unexpected error occurred");
            setError(msg);
            toast.error(msg);
            return undefined;
        } finally {
            setIsProcessing(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const executeDirect = useCallback(async (calls: any[]): Promise<string> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = await account!.execute(calls as any);
        return tx.transaction_hash;
    }, [account]);

    // Builds shared timing/nonce/currency fields for an order.
    const buildBaseOrderParams = useCallback(async (
        currencySymbol: string,
        durationSeconds: number,
        contract: NonNullable<typeof medialaneContract>
    ) => {
        const now = Math.floor(Date.now() / 1000);
        const startTime = (now + 300).toString();
        const endTime = (now + durationSeconds).toString();
        const salt = Math.floor(Math.random() * 1000000).toString();

        const { SUPPORTED_TOKENS } = await import("@/lib/constants");
        const currencyAddress = SUPPORTED_TOKENS.find((t: any) => t.symbol === currencySymbol)?.address;
        if (!currencyAddress) throw new Error("Unsupported currency selected");

        const currentNonce = await contract.nonces(walletAddress!);
        const nonce = currentNonce.toString();

        return { startTime, endTime, salt, currencyAddress, nonce };
    }, [walletAddress]);

    // Signs the orderParams, verifies the hash against the contract, and returns a
    // populated register_order call ready to include in a multicall.
    const signAndBuildRegisterCall = useCallback(async (
        orderParams: any,
        contract: NonNullable<typeof medialaneContract>
    ) => {
        const chainId = chain!.id as any as constants.StarknetChainId;
        const typedData = stringifyBigInts(getOrderParametersTypedData(orderParams, chainId));

        const signature = await account!.signMessage(typedData);
        const signatureArray = Array.isArray(signature)
            ? signature
            : [signature.r.toString(), signature.s.toString()];

        const registerPayload = stringifyBigInts({
            parameters: {
                ...orderParams,
                offer: {
                    ...orderParams.offer,
                    item_type: shortString.encodeShortString(orderParams.offer.item_type),
                },
                consideration: {
                    ...orderParams.consideration,
                    item_type: shortString.encodeShortString(orderParams.consideration.item_type),
                },
            },
            signature: signatureArray,
        });

        // Hash verification
        try {
            const localHash = await account!.hashMessage(typedData);
            const contractHash = await contract.get_order_hash(registerPayload.parameters, walletAddress!);
            const contractHashHex = "0x" + BigInt(contractHash).toString(16);
            if (localHash !== contractHashHex) {
                console.warn("[marketplace] Hash mismatch — signature may be rejected by contract");
            }
        } catch (hashErr) {
            console.warn("Could not verify hash:", hashErr);
        }

        return contract.populate("register_order", [registerPayload]);
    }, [account, chain, walletAddress]);

    const createListing = useCallback(async (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string,
        amount?: string
    ) => {
        const is1155 = tokenStandard === "ERC1155";
        const contract = is1155 ? medialane1155Contract : medialaneContract;

        if (!walletAddress || !contract || !chain) {
            const msg = "Account, contract, or network not available";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!account) {
            const msg = "Marketplace listing requires Argent X or Braavos wallet";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            const priceWei = toWei(price, currencySymbol);
            const { startTime, endTime, salt, currencyAddress, nonce } =
                await buildBaseOrderParams(currencySymbol, durationSeconds, contract);

            // ── ERC-1155 path ─────────────────────────────────────────────────
            if (is1155) {
                const listAmount = amount ?? "1";
                const orderParams1155 = {
                    offerer: walletAddress,
                    offer: {
                        item_type: "ERC1155",
                        token: assetContractAddress,
                        identifier_or_criteria: tokenId,
                        start_amount: listAmount,
                        end_amount: listAmount,
                    },
                    consideration: {
                        item_type: "ERC20",
                        token: currencyAddress,
                        identifier_or_criteria: "0",
                        start_amount: priceWei,
                        end_amount: priceWei,
                        recipient: walletAddress,
                    },
                    start_time: startTime,
                    end_time: endTime,
                    salt,
                    nonce,
                };
                const chainId = chain!.id as any as constants.StarknetChainId;
                const typedData1155 = stringifyBigInts(
                    get1155OrderParametersTypedData(orderParams1155 as Record<string, unknown>, chainId)
                );
                const signature1155 = await account!.signMessage(typedData1155);
                const signatureArray1155 = Array.isArray(signature1155)
                    ? signature1155
                    : [signature1155.r.toString(), signature1155.s.toString()];
                const registerCall1155 = contract.populate("register_order", [{
                    parameters: {
                        ...orderParams1155,
                        offer: {
                            ...orderParams1155.offer,
                            item_type: shortString.encodeShortString(orderParams1155.offer.item_type),
                        },
                        consideration: {
                            ...orderParams1155.consideration,
                            item_type: shortString.encodeShortString(orderParams1155.consideration.item_type),
                        },
                    },
                    signature: signatureArray1155,
                }]);
                let isAlreadyApproved1155 = false;
                try {
                    const res = await provider.callContract({
                        contractAddress: assetContractAddress,
                        entrypoint: "is_approved_for_all",
                        calldata: [walletAddress!, contract.address],
                    });
                    isAlreadyApproved1155 = BigInt(res[0]) !== 0n;
                } catch (err) {
                    console.warn("Failed to check ERC1155 approval status", err);
                }
                const approveCall1155 = {
                    contractAddress: assetContractAddress,
                    entrypoint: "set_approval_for_all",
                    calldata: [contract.address, "1"],
                };
                const calls1155 = isAlreadyApproved1155 ? [registerCall1155] : [approveCall1155, registerCall1155];
                const hash1155 = await executeDirect(calls1155);
                setTxHash(hash1155);
                const receipt1155 = await provider.waitForTransaction(hash1155);
                assertTransactionSucceeded(receipt1155);
                assertOrderCreated(receipt1155, contract.address);
                refreshMarketplaceCaches();
                toast.success("Listing Created", { description: "Your edition has been listed successfully." });
                return hash1155;
            }
            // ── ERC-721 path — unchanged below ────────────────────────────────

            const orderParams = {
                offerer: walletAddress,
                offer: {
                    item_type: "ERC721",
                    token: assetContractAddress,
                    identifier_or_criteria: tokenId,
                    start_amount: "1",
                    end_amount: "1",
                },
                consideration: {
                    item_type: "ERC20",
                    token: currencyAddress,
                    identifier_or_criteria: "0",
                    start_amount: priceWei,
                    end_amount: priceWei,
                    recipient: walletAddress,
                },
                start_time: startTime,
                end_time: endTime,
                salt,
                nonce,
            };

            const registerCall = await signAndBuildRegisterCall(orderParams, contract);

            const { cairo } = await import("starknet");
            let approveCall: any;
            let isAlreadyApproved = false;

            const tokenIdUint256 = cairo.uint256(tokenId);
            try {
                const res = await provider.callContract({
                    contractAddress: assetContractAddress,
                    entrypoint: "get_approved",
                    calldata: [tokenIdUint256.low.toString(), tokenIdUint256.high.toString()],
                });
                isAlreadyApproved =
                    BigInt(res[0]).toString() === BigInt(contract.address).toString();
            } catch (err) {
                console.warn("Failed to check ERC721 approval status", err);
            }
            approveCall = {
                contractAddress: assetContractAddress,
                entrypoint: "approve",
                calldata: [contract.address, tokenIdUint256.low.toString(), tokenIdUint256.high.toString()],
            };

            const calls = isAlreadyApproved ? [registerCall] : [approveCall, registerCall];
            const hash = await executeDirect(calls);
            setTxHash(hash);
            const receipt = await provider.waitForTransaction(hash);
            assertTransactionSucceeded(receipt);
            assertOrderCreated(receipt, contract.address);
            refreshMarketplaceCaches();
            toast.success("Listing Created", { description: "Your asset has been listed successfully." });
            return hash;
        });
    }, [account, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, buildBaseOrderParams, signAndBuildRegisterCall, executeDirect, refreshMarketplaceCaches]);

    const makeOffer = useCallback(async (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string
    ) => {
        const is1155 = tokenStandard === "ERC1155";
        const contract = is1155 ? medialane1155Contract : medialaneContract;

        if (!walletAddress || !contract || !chain) {
            const msg = "Account, contract, or network not available";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!account) {
            const msg = "Making offers requires Argent X or Braavos wallet";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            const priceWei = toWei(price, currencySymbol);
            const { startTime, endTime, salt, currencyAddress, nonce } =
                await buildBaseOrderParams(currencySymbol, durationSeconds, contract);

            // Inverted vs. listing: offerer sends ERC20, receives the NFT
            const orderParams = {
                offerer: walletAddress,
                offer: {
                    item_type: "ERC20",
                    token: currencyAddress,
                    identifier_or_criteria: "0",
                    start_amount: priceWei,
                    end_amount: priceWei,
                },
                consideration: {
                    item_type: is1155 ? "ERC1155" : "ERC721",
                    token: assetContractAddress,
                    identifier_or_criteria: tokenId,
                    start_amount: "1",
                    end_amount: "1",
                    recipient: walletAddress,
                },
                start_time: startTime,
                end_time: endTime,
                salt,
                nonce,
            };

            let registerCall: any;
            if (is1155) {
                const chainId = chain!.id as any as constants.StarknetChainId;
                const typedData = stringifyBigInts(
                    get1155OrderParametersTypedData(orderParams as Record<string, unknown>, chainId)
                );
                const signature = await account!.signMessage(typedData);
                const signatureArray = Array.isArray(signature)
                    ? signature
                    : [signature.r.toString(), signature.s.toString()];
                registerCall = contract.populate("register_order", [{
                    parameters: {
                        ...orderParams,
                        offer: {
                            ...orderParams.offer,
                            item_type: shortString.encodeShortString(orderParams.offer.item_type),
                        },
                        consideration: {
                            ...orderParams.consideration,
                            item_type: shortString.encodeShortString(orderParams.consideration.item_type),
                        },
                    },
                    signature: signatureArray,
                }]);
            } else {
                registerCall = await signAndBuildRegisterCall(orderParams, contract);
            }

            const { cairo } = await import("starknet");
            const amountUint256 = cairo.uint256(priceWei);
            const approveCall = {
                contractAddress: currencyAddress,
                entrypoint: "approve",
                calldata: [contract.address, amountUint256.low.toString(), amountUint256.high.toString()],
            };

            // ERC20 approve + register_order as atomic multicall
            const hash = await executeDirect([approveCall, registerCall]);
            setTxHash(hash);
            const receipt = await provider.waitForTransaction(hash);
            assertTransactionSucceeded(receipt);
            assertOrderCreated(receipt, contract.address);
            refreshMarketplaceCaches();
            toast.success("Offer Placed", { description: "Your offer has been submitted and is now live." });
            return hash;
        });
    }, [account, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, buildBaseOrderParams, signAndBuildRegisterCall, executeDirect, refreshMarketplaceCaches]);

    const checkoutCart = useCallback(async (items: any[]) => {
        if (!walletAddress || !medialaneContract || !chain || items.length === 0) {
            const msg = "Account, contract, network not available, or cart empty";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!account) {
            const msg = "Checkout requires Argent X or Braavos wallet";
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

            // Fetch base nonces per contract — each fulfillment increments sequentially
            const baseNonce721 = BigInt(await medialaneContract.nonces(walletAddress));
            const baseNonce1155 = medialane1155Contract
                ? BigInt(await medialane1155Contract.nonces(walletAddress))
                : 0n;

            const chainId = chain.id as any as constants.StarknetChainId;
            const fulfillCalls: any[] = [];
            let counter721 = 0;
            let counter1155 = 0;

            // Prompt one signature per item — must be sequential per SNIP-12
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                if (item.isERC1155) {
                    const executionNonce = baseNonce1155 + BigInt(counter1155++);
                    const quantity = item.quantity ?? "1";
                    const fulfillmentParams = {
                        order_hash: item.orderHash,
                        fulfiller: walletAddress,
                        quantity,
                        nonce: executionNonce.toString(),
                    };
                    const typedData = stringifyBigInts(
                        get1155OrderFulfillmentTypedData(fulfillmentParams as Record<string, unknown>, chainId)
                    );
                    toast.info(`Signature Required (${i + 1}/${items.length})`, {
                        description: `Please sign the purchase for edition ${item.offerIdentifier}`,
                    });
                    const signature = await account.signMessage(typedData);
                    const signatureArray = Array.isArray(signature)
                        ? signature
                        : [signature.r.toString(), signature.s.toString()];
                    fulfillCalls.push(
                        medialane1155Contract!.populate("fulfill_order", [{
                            fulfillment: fulfillmentParams,
                            signature: signatureArray,
                        }])
                    );
                } else {
                    const executionNonce = baseNonce721 + BigInt(counter721++);
                    const fulfillmentParams = {
                        order_hash: item.orderHash,
                        fulfiller: walletAddress,
                        nonce: executionNonce.toString(),
                    };
                    const typedData = stringifyBigInts(getOrderFulfillmentTypedData(fulfillmentParams, chainId));
                    toast.info(`Signature Required (${i + 1}/${items.length})`, {
                        description: `Please sign the request for ${item.offerIdentifier}`,
                    });
                    const signature = await account.signMessage(typedData);
                    const signatureArray = Array.isArray(signature)
                        ? signature
                        : [signature.r.toString(), signature.s.toString()];
                    fulfillCalls.push(
                        medialaneContract.populate("fulfill_order", [{
                            fulfillment: fulfillmentParams,
                            signature: signatureArray,
                        }])
                    );
                }
            }

            toast.info("Executing Purchase", { description: "Approve the final transaction to sweep the cart." });

            // Single atomic multicall: all approvals + all fulfillments
            const hash = await executeDirect([...approveCalls721, ...approveCalls1155, ...fulfillCalls]);
            setTxHash(hash);
            const receipt = await provider.waitForTransaction(hash);
            if ((receipt as any).execution_status === "REVERTED") {
                throw new Error((receipt as any).revert_reason || "Transaction reverted on-chain. Check the explorer for details.");
            }
            refreshMarketplaceCaches();
            toast.success("Purchase Successful", { description: `Successfully purchased ${items.length} item(s).` });
            return hash;
        });
    }, [account, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, executeDirect, refreshMarketplaceCaches]);

    const cancelOrder = useCallback(async (orderHash: string, tokenStandard?: string) => {
        const is1155 = tokenStandard === "ERC1155";
        const contract = is1155 ? medialane1155Contract : medialaneContract;

        if (!walletAddress || !contract || !chain) {
            const msg = "Account, contract, or network not available";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!account) {
            const msg = "Cancelling orders requires Argent X or Braavos wallet";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            const currentNonce = await contract.nonces(walletAddress);

            const cancelParams = {
                order_hash: orderHash,
                offerer: walletAddress,
                nonce: currentNonce.toString(),
            };

            const chainId = chain.id as any as constants.StarknetChainId;
            const typedData = stringifyBigInts(
                is1155
                    ? get1155OrderCancellationTypedData(cancelParams as Record<string, unknown>, chainId)
                    : getOrderCancellationTypedData(cancelParams, chainId)
            );

            const signature = await account.signMessage(typedData);
            const signatureArray = Array.isArray(signature)
                ? signature
                : [signature.r.toString(), signature.s.toString()];

            const cancelRequest = stringifyBigInts({
                cancelation: cancelParams,
                signature: signatureArray,
            });

            const call = contract.populate("cancel_order", [cancelRequest]);
            const hash = await executeDirect([call]);
            setTxHash(hash);
            const receipt = await provider.waitForTransaction(hash);
            if ((receipt as any).execution_status === "REVERTED") {
                throw new Error((receipt as any).revert_reason || "Transaction reverted on-chain. Check the explorer for details.");
            }
            refreshMarketplaceCaches();
            toast.success("Listing Cancelled", { description: "The listing has been successfully cancelled on-chain." });
            return hash;
        });
    }, [account, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, executeDirect, refreshMarketplaceCaches]);

    /**
     * Asset owner accepts an incoming bid. Signs OrderFulfillment typed data,
     * approves the NFT transfer to the marketplace, then executes both calls
     * atomically so either both succeed or neither does.
     */
    const acceptOffer = useCallback(async (
        orderHash: string,
        nftContractAddress: string,
        tokenId: string,
        tokenStandard?: string
    ) => {
        const is1155 = tokenStandard === "ERC1155";
        const contract = is1155 ? medialane1155Contract : medialaneContract;

        if (!walletAddress || !contract || !chain) {
            const msg = "Account, contract, or network not available";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!account) {
            const msg = "Accepting offers requires Argent X or Braavos wallet";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            const currentNonce = await contract.nonces(walletAddress);

            const fulfillmentParams: Record<string, unknown> = {
                order_hash: orderHash,
                fulfiller: walletAddress,
                nonce: currentNonce.toString(),
                ...(is1155 ? { quantity: "1" } : {}),
            };

            const chainId = chain.id as any as constants.StarknetChainId;
            const typedData = stringifyBigInts(
                is1155
                    ? get1155OrderFulfillmentTypedData(fulfillmentParams, chainId)
                    : getOrderFulfillmentTypedData(fulfillmentParams, chainId)
            );

            const signature = await account.signMessage(typedData);
            const signatureArray = Array.isArray(signature)
                ? signature
                : [signature.r.toString(), signature.s.toString()];

            const fulfillCall = contract.populate("fulfill_order", [{
                fulfillment: fulfillmentParams,
                signature: signatureArray,
            }]);

            // Owner must approve the NFT transfer before fulfilling
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

            const hash = await executeDirect([approveCall, fulfillCall]);
            setTxHash(hash);
            const receipt = await provider.waitForTransaction(hash);
            if ((receipt as any).execution_status === "REVERTED") {
                throw new Error((receipt as any).revert_reason || "Transaction reverted on-chain. Check the explorer for details.");
            }
            refreshMarketplaceCaches();
            toast.success("Offer Accepted", { description: "The offer has been accepted and the asset transferred." });
            return hash;
        });
    }, [account, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, executeDirect, refreshMarketplaceCaches]);

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
