import { useState, useCallback } from "react";
import { useAccount, useContract, useNetwork, useProvider } from "@starknet-react/core";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { Abi, shortString, constants, num } from "starknet";
import { useSWRConfig } from "swr";
import { IPMarketplaceABI, Medialane1155ABI as IPMarketplace1155ABI } from "@medialane/sdk";
import { toast } from "sonner";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { dappFeeConfig, buildFeeCall } from "@/lib/fee";
import type { CheckoutItem } from "@/lib/checkout";
import {
    getOrderParametersTypedData,
    getOrderCancellationTypedData,
    get1155OrderParametersTypedData,
    get1155OrderCancellationTypedData,
    stringifyBigInts,
} from "@/utils/marketplace-utils";

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
import { SUPPORTED_TOKENS, MARKETPLACE_721_CONTRACT, MARKETPLACE_1155_CONTRACT, INDEXER_REVALIDATION_DELAY_MS } from "@/lib/constants";
const getDecimals = (currencySymbol: string) =>
    SUPPORTED_TOKENS.find((t) => t.symbol === currencySymbol)?.decimals ?? 18;

const toWei = (price: string, currencySymbol: string): string =>
    BigInt(Math.floor(parseFloat(price) * Math.pow(10, getDecimals(currencySymbol)))).toString();

// Full-felt (248-bit) random salt. In the 0.26.0 schema the nonce was removed,
// so salt is the SOLE order-hash uniqueness source — it must be wide to avoid
// hash collisions the contract would reject. Mirrors @medialane/sdk generateSalt.
const generateSalt = (): string => {
    const bytes = new Uint8Array(31);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return num.toHex(BigInt("0x" + hex));
};

const ORDER_CREATED_SELECTOR = "0x3427759bfd3b941f14e687e129519da3c9b0046c5b9aaa290bb1dede63753b3";

const sameAddress = (a?: string, b?: string) => {
    if (!a || !b) return false;
    try {
        return BigInt(a).toString() === BigInt(b).toString();
    } catch {
        return a.toLowerCase() === b.toLowerCase();
    }
};

const U256_BASE = 1n << 128n;

const parseU256Result = (result: string[]): bigint => {
    if (!Array.isArray(result) || result.length === 0) return 0n;
    const low = BigInt(result[0] ?? 0);
    const high = BigInt(result[1] ?? 0);
    return low + high * U256_BASE;
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
    // StarkZap (Cartridge/Privy) wallet. The ACTIVE-WALLET SLOT decides which
    // rail signs/executes (2026-06-07 redesign) — a bare `szWallet ?? account`
    // priority would let a lingering Cartridge/Privy session sign orders for a
    // different wallet than the one the user explicitly connected.
    const { wallet: szWalletRaw } = useStarkZapWallet();
    const { walletType } = useWallet();
    const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
    const { chain } = useNetwork();
    const { provider } = useProvider();
    const { mutate } = useSWRConfig();

    const [isProcessing, setIsProcessing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { contract: medialaneContract } = useContract({
        address: MARKETPLACE_721_CONTRACT,
        abi: IPMarketplaceABI as unknown as Abi,
    });
    const { contract: medialane1155Contract } = useContract({
        address: MARKETPLACE_1155_CONTRACT,
        abi: IPMarketplace1155ABI as unknown as Abi,
    });
    const { address: walletAddress } = useUnifiedWallet();

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

    const executeDirect = useCallback(async (calls: any[]): Promise<string> => {
        // StarkZap (Cartridge/Privy): its SDK handles gas/sponsorship + waits.
        if (szWallet) {
            const tx = await szWallet.execute(calls);
            return tx.hash;
        }
        if (!account) {
            throw new Error("Wallet not ready. Please reconnect and try again.");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = await account.execute(calls as any);
        return tx.transaction_hash;
    }, [szWallet, account]);

    // Signs typed data with whichever wallet is active. starknet account and
    // StarkZap WalletInterface both implement signMessage(typedData): Signature;
    // callers normalize the result via signatureArray (handles [] or {r,s}).
    const signTypedData = useCallback(async (typedData: any): Promise<any> => {
        const signer = szWallet ?? account;
        if (!signer) {
            throw new Error("Wallet not ready. Please reconnect and try again.");
        }
        return signer.signMessage(typedData);
    }, [szWallet, account]);

    const getErc20Allowance = useCallback(async (
        tokenAddress: string,
        owner: string,
        spender: string
    ): Promise<bigint> => {
        try {
            const result = await provider.callContract({
                contractAddress: tokenAddress,
                entrypoint: "allowance",
                calldata: [owner, spender],
            });
            return parseU256Result(result);
        } catch (err) {
            console.warn("Failed to check ERC20 allowance", err);
            return 0n;
        }
    }, [provider]);

    // Builds shared timing/counter/currency fields for an order.
    const buildBaseOrderParams = useCallback(async (
        currencySymbol: string,
        durationSeconds: number,
        contract: NonNullable<typeof medialaneContract>
    ) => {
        const now = Math.floor(Date.now() / 1000);
        const startTime = (now + 30).toString(); // ~6s blocks — small inclusion buffer
        const endTime = (now + durationSeconds).toString();
        const salt = generateSalt();

        const { SUPPORTED_TOKENS } = await import("@/lib/constants");
        const currencyAddress = SUPPORTED_TOKENS.find((t: any) => t.symbol === currencySymbol)?.address;
        if (!currencyAddress) throw new Error("Unsupported currency selected");

        // 0.26.0: per-offerer monotonic counter replaces the removed nonce.
        const currentCounter = await contract.get_counter(walletAddress!);
        const counter = currentCounter.toString();

        return { startTime, endTime, salt, currencyAddress, counter };
    }, [walletAddress]);

    // Signed EIP-2981 royalty cap (bps) for an order. Reads the NFT's live 2981
    // rate via royalty_info(tokenId, 10000) — the returned amount equals the bps
    // at salePrice 10000. Non-2981 NFTs / failures yield "0" (never over-pay).
    const resolveRoyaltyMaxBps = useCallback(async (
        nft: string,
        tokenId: string
    ): Promise<string> => {
        try {
            const { cairo } = await import("starknet");
            const id = cairo.uint256(tokenId);
            const res = await provider.callContract({
                contractAddress: nft,
                entrypoint: "royalty_info",
                calldata: [id.low.toString(), id.high.toString(), "10000", "0"],
            });
            return BigInt(res[1] ?? "0").toString();
        } catch {
            return "0";
        }
    }, [provider]);

    // Signs the orderParams, verifies the hash against the contract, and returns a
    // populated register_order call ready to include in a multicall.
    const signAndBuildRegisterCall = useCallback(async (
        orderParams: any,
        contract: NonNullable<typeof medialaneContract>
    ) => {
        const chainId = ('0x' + chain!.id.toString(16)) as constants.StarknetChainId;
        const typedData = stringifyBigInts(getOrderParametersTypedData(orderParams, chainId));

        const signature = await signTypedData(typedData);
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

        // Hash verification (best-effort, account-only — StarkZap wallets don't
        // expose hashMessage; the check is just a warning and never gates submit).
        try {
            if (account?.hashMessage) {
                const localHash = await account.hashMessage(typedData);
                const contractHash = await contract.get_order_hash(registerPayload.parameters, walletAddress!);
                const contractHashHex = "0x" + BigInt(contractHash).toString(16);
                if (localHash !== contractHashHex) {
                    console.warn("[marketplace] Hash mismatch — signature may be rejected by contract");
                }
            }
        } catch (hashErr) {
            console.warn("Could not verify hash:", hashErr);
        }

        return contract.populate("register_order", [registerPayload]);
    }, [account, chain, walletAddress, signTypedData]);

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
        const is1155 = tokenStandard === "ERC1155";
        const contract = is1155 ? medialane1155Contract : medialaneContract;

        if (!walletAddress || !contract || !chain) {
            const msg = "Account, contract, or network not available";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!szWallet && !account) {
            const msg = "Wallet not ready. Please reconnect and try again.";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            const priceWei = toWei(price, currencySymbol);
            const { startTime, endTime, salt, currencyAddress, counter } =
                await buildBaseOrderParams(currencySymbol, durationSeconds, contract);
            const royaltyMaxBps = await resolveRoyaltyMaxBps(assetContractAddress, tokenId);

            // ── ERC-1155 path ─────────────────────────────────────────────────
            if (is1155) {
                const listAmount = amount ?? "1";
                const orderParams1155 = {
                    offerer: walletAddress,
                    marketplace: contract.address,
                    offer: {
                        item_type: "ERC1155",
                        token: assetContractAddress,
                        identifier_or_criteria: tokenId,
                        amount: listAmount,
                    },
                    consideration: {
                        item_type: "ERC20",
                        token: currencyAddress,
                        identifier_or_criteria: "0",
                        amount: priceWei,
                        recipient: walletAddress,
                    },
                    royalty_max_bps: royaltyMaxBps,
                    start_time: startTime,
                    end_time: endTime,
                    salt,
                    counter,
                };
                const chainId = ('0x' + chain!.id.toString(16)) as constants.StarknetChainId;
                const typedData1155 = stringifyBigInts(
                    get1155OrderParametersTypedData(orderParams1155 as Record<string, unknown>, chainId)
                );
                const signature1155 = await signTypedData(typedData1155);
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
                if (!opts?.silent) toast.success("Listing Created", { description: "Your edition has been listed successfully." });
                return hash1155;
            }
            // ── ERC-721 path — unchanged below ────────────────────────────────

            const orderParams = {
                offerer: walletAddress,
                marketplace: contract.address,
                offer: {
                    item_type: "ERC721",
                    token: assetContractAddress,
                    identifier_or_criteria: tokenId,
                    amount: "1",
                },
                consideration: {
                    item_type: "ERC20",
                    token: currencyAddress,
                    identifier_or_criteria: "0",
                    amount: priceWei,
                    recipient: walletAddress,
                },
                royalty_max_bps: royaltyMaxBps,
                start_time: startTime,
                end_time: endTime,
                salt,
                counter,
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
            if (!opts?.silent) toast.success("Listing Created", { description: "Your asset has been listed successfully." });
            return hash;
        });
    }, [account, szWallet, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, buildBaseOrderParams, signAndBuildRegisterCall, executeDirect, refreshMarketplaceCaches, resolveRoyaltyMaxBps, signTypedData]);

    const makeOffer = useCallback(async (
        assetContractAddress: string,
        tokenId: string,
        price: string,
        currencySymbol: string,
        durationSeconds: number,
        tokenStandard?: string,
        opts?: WriteOpts
    ) => {
        const is1155 = tokenStandard === "ERC1155";
        const contract = is1155 ? medialane1155Contract : medialaneContract;

        if (!walletAddress || !contract || !chain) {
            const msg = "Account, contract, or network not available";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!szWallet && !account) {
            const msg = "Wallet not ready. Please reconnect and try again.";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            const priceWei = toWei(price, currencySymbol);
            const { startTime, endTime, salt, currencyAddress, counter } =
                await buildBaseOrderParams(currencySymbol, durationSeconds, contract);
            const royaltyMaxBps = await resolveRoyaltyMaxBps(assetContractAddress, tokenId);

            // Inverted vs. listing: offerer sends ERC20, receives the NFT
            const orderParams = {
                offerer: walletAddress,
                marketplace: contract.address,
                offer: {
                    item_type: "ERC20",
                    token: currencyAddress,
                    identifier_or_criteria: "0",
                    amount: priceWei,
                },
                consideration: {
                    item_type: is1155 ? "ERC1155" : "ERC721",
                    token: assetContractAddress,
                    identifier_or_criteria: tokenId,
                    amount: "1",
                    recipient: walletAddress,
                },
                royalty_max_bps: royaltyMaxBps,
                start_time: startTime,
                end_time: endTime,
                salt,
                counter,
            };

            let registerCall: any;
            if (is1155) {
                const chainId = ('0x' + chain!.id.toString(16)) as constants.StarknetChainId;
                const typedData = stringifyBigInts(
                    get1155OrderParametersTypedData(orderParams as Record<string, unknown>, chainId)
                );
                const signature = await signTypedData(typedData);
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
            const requiredAllowance = BigInt(priceWei);
            const currentAllowance = await getErc20Allowance(currencyAddress, walletAddress, contract.address);
            const calls = [registerCall];

            if (currentAllowance < requiredAllowance) {
                const amountUint256 = cairo.uint256(priceWei);
                calls.unshift({
                    contractAddress: currencyAddress,
                    entrypoint: "approve",
                    calldata: [contract.address, amountUint256.low.toString(), amountUint256.high.toString()],
                });
            }

            const hash = await executeDirect(calls);
            setTxHash(hash);
            const receipt = await provider.waitForTransaction(hash);
            assertTransactionSucceeded(receipt);
            assertOrderCreated(receipt, contract.address);
            refreshMarketplaceCaches();
            if (!opts?.silent) toast.success("Offer Placed", { description: "Your offer has been submitted and is now live." });
            return hash;
        });
    }, [account, szWallet, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, buildBaseOrderParams, signAndBuildRegisterCall, getErc20Allowance, executeDirect, refreshMarketplaceCaches, resolveRoyaltyMaxBps, signTypedData]);

    const checkoutCart = useCallback(async (items: CheckoutItem[], opts?: WriteOpts) => {
        if (!walletAddress || !medialaneContract || !chain || items.length === 0) {
            const msg = "Account, contract, network not available, or cart empty";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!szWallet && !account) {
            const msg = "Wallet not ready. Please reconnect and try again.";
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
            const hash = await executeDirect([...approveCalls721, ...approveCalls1155, ...fulfillCalls, ...feeCalls]);
            setTxHash(hash);
            const receipt = await provider.waitForTransaction(hash);
            assertTransactionSucceeded(receipt);
            refreshMarketplaceCaches();
            if (!opts?.silent) toast.success("Purchase Successful", { description: `Successfully purchased ${items.length} item(s).` });
            return hash;
        });
    }, [account, szWallet, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, executeDirect, refreshMarketplaceCaches]);

    const cancelOrder = useCallback(async (orderHash: string, tokenStandard?: string, kind: "listing" | "offer" = "listing", opts?: WriteOpts) => {
        const is1155 = tokenStandard === "ERC1155";
        const contract = is1155 ? medialane1155Contract : medialaneContract;

        if (!walletAddress || !contract || !chain) {
            const msg = "Account, contract, or network not available";
            setError(msg);
            toast.error(msg);
            return undefined;
        }
        if (!szWallet && !account) {
            const msg = "Wallet not ready. Please reconnect and try again.";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            const cancelParams = {
                order_hash: orderHash,
                offerer: walletAddress,
            };

            const chainId = ('0x' + chain.id.toString(16)) as constants.StarknetChainId;
            const typedData = stringifyBigInts(
                is1155
                    ? get1155OrderCancellationTypedData(cancelParams as Record<string, unknown>, chainId)
                    : getOrderCancellationTypedData(cancelParams, chainId)
            );

            const signature = await signTypedData(typedData);
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
            assertTransactionSucceeded(receipt);
            refreshMarketplaceCaches();
            if (!opts?.silent) {
                toast.success(
                    kind === "offer" ? "Offer Cancelled" : "Listing Cancelled",
                    { description: `The ${kind} has been successfully cancelled on-chain.` }
                );
            }
            return hash;
        });
    }, [account, szWallet, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, executeDirect, refreshMarketplaceCaches, signTypedData]);

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
        if (!szWallet && !account) {
            const msg = "Wallet not ready. Please reconnect and try again.";
            setError(msg);
            toast.error(msg);
            return undefined;
        }

        return withProcessing(async () => {
            // Fulfilment is unsigned in 0.26.0 — the owner (caller) is the fulfiller.
            const fulfillCall = is1155
                ? contract.populate("fulfill_order", [orderHash, "1"])
                : contract.populate("fulfill_order", [orderHash]);

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
            assertTransactionSucceeded(receipt);
            refreshMarketplaceCaches();
            return hash;
        });
    }, [account, szWallet, walletAddress, medialaneContract, medialane1155Contract, chain, provider, withProcessing, executeDirect, refreshMarketplaceCaches]);

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
