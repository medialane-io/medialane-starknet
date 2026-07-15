"use client";

import useSWR from "swr";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import { starknetProvider } from "@/lib/starknet";
import { normalizeAddress, type ApiCollection } from "@medialane/sdk";

const BASE = MEDIALANE_BACKEND_URL.replace(/\/$/, "");

async function backendFetch<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Backend fetch failed: ${res.status}`);
  return res.json();
}

// deploy_club encodes an unlimited member cap as u64::MAX.
const UNLIMITED = 0xffffffffffffffffn;

function u256(res: string[], i = 0): bigint {
  return BigInt(res[i] ?? "0") + (BigInt(res[i + 1] ?? "0") << 128n);
}

// ── useClubCollections ────────────────────────────────────────────────────────

export function useClubCollections() {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[]; meta: unknown }>(
    "ip-club-collections",
    () => {
      const params = new URLSearchParams({ service: "ip-club", limit: "50" });
      return backendFetch(`${BASE}/v1/collections?${params}`);
    },
    { revalidateOnFocus: false }
  );

  return { collections: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

// ── useClubInfo ────────────────────────────────────────────────────────────────

export interface ClubInfo {
  open: boolean;
  numMembers: number;
  maxMembers: number | null;
  entryFee: string | null;
  paymentToken: string | null;
}

/**
 * Club state read straight from the IPClubCollection contract — the authority.
 * A club is a standalone ERC-721 deployed by the factory; there is no backend
 * club record. Uses the failover RPC provider so it works signed-out.
 */
export function useClubInfo(clubAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ClubInfo>(
    clubAddress ? `club-info-${clubAddress}` : null,
    async () => {
      const call = (entrypoint: string) =>
        starknetProvider.callContract({ contractAddress: clubAddress!, entrypoint, calldata: [] });
      const [openR, feeR, tokenR, maxR, mintedR] = await Promise.all([
        call("is_open"),
        call("entry_fee"),
        call("payment_token"),
        call("max_supply"),
        call("total_minted"),
      ]);
      const entryFee = u256(feeR);
      const paymentTokenRaw = BigInt(tokenR[0] ?? "0");
      const maxSupply = u256(maxR);
      return {
        open: BigInt(openR[0] ?? "0") !== 0n,
        numMembers: Number(u256(mintedR)),
        maxMembers: maxSupply >= UNLIMITED ? null : Number(maxSupply),
        entryFee: entryFee > 0n ? entryFee.toString() : null,
        paymentToken:
          paymentTokenRaw > 0n ? normalizeAddress("STARKNET", "0x" + paymentTokenRaw.toString(16)) : null,
      };
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { info: data ?? null, isLoading, error, mutate };
}

// ── useClubMembership ──────────────────────────────────────────────────────────

/** Membership = holding a card: `balance_of(wallet) > 0` on the club contract. */
export function useClubMembership(clubAddress: string | null, wallet: string | null) {
  const key = clubAddress && wallet ? `club-membership-${clubAddress}-${wallet}` : null;

  const { data, error, isLoading, mutate } = useSWR<{ isMember: boolean }>(
    key,
    async () => {
      const res = await starknetProvider.callContract({
        contractAddress: clubAddress!,
        entrypoint: "balance_of",
        calldata: [wallet!],
      });
      return { isMember: u256(res) > 0n };
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { isMember: data?.isMember ?? false, isLoading, error, mutate };
}
