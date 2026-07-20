import { type TypedData, constants } from "starknet";
import {
    buildOrderTypedData,
    build1155OrderTypedData,
    buildCancellationTypedData,
    build1155CancellationTypedData,
} from "@medialane/sdk/starknet";

// SNIP-12 typed-data construction is owned by @medialane/sdk (0.26.0 redesigned
// schema: domain v4/v3, single `amount`, `marketplace`/`royalty_max_bps`/`counter`,
// no nonce). These thin wrappers keep the call sites stable while delegating to
// the SDK so the dapp can never drift from the contracts' expected schema.
//
// Note: there are no fulfillment builders — fulfilment is UNSIGNED in the new
// protocol (the caller is the fulfiller).

/** SNIP-12 typed data for ERC-721 OrderParameters (domain "Medialane" v4). */
export const getOrderParametersTypedData = (
    message: Record<string, unknown>,
    chainId: constants.StarknetChainId,
): TypedData => buildOrderTypedData(message, chainId);

/** SNIP-12 typed data for ERC-1155 OrderParameters (domain "Medialane" v3). */
export const get1155OrderParametersTypedData = (
    message: Record<string, unknown>,
    chainId: constants.StarknetChainId,
): TypedData => build1155OrderTypedData(message, chainId);

/** SNIP-12 typed data for ERC-721 OrderCancellation (no nonce). */
export const getOrderCancellationTypedData = (
    message: Record<string, unknown>,
    chainId: constants.StarknetChainId,
): TypedData => buildCancellationTypedData(message, chainId);

/** SNIP-12 typed data for ERC-1155 OrderCancellation (no nonce). */
export const get1155OrderCancellationTypedData = (
    message: Record<string, unknown>,
    chainId: constants.StarknetChainId,
): TypedData => build1155CancellationTypedData(message, chainId);

export const stringifyBigInts = (obj: any): any => {
    if (typeof obj === "bigint") {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(stringifyBigInts);
    }
    if (obj !== null && typeof obj === "object") {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, stringifyBigInts(value)])
        );
    }
    return obj;
};
