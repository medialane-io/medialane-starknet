"use client";

import useSWR from "swr";
import { useMedialaneClient } from "./use-medialane-client";
import { starknetProvider } from "@/lib/starknet";
import { Contract, cairo } from "starknet";
import { IPClubCollectionABI } from "@medialane/sdk";

// ── useMyClubCollections ──────────────────────────────────────────────────────
// The connected creator's club collections (launchpad browse page).

export function useMyClubCollections(ownerAddress: string | null) {
  const client = useMedialaneClient();

  const { data, error, isLoading, mutate } = useSWR(
    ownerAddress ? `my-club-collections-${ownerAddress}` : null,
    () => client.api.getCollectionsByOwner(ownerAddress!),
    { revalidateOnFocus: false }
  );

  const collections = (data?.data ?? []).filter((c) => c.service === "ip-club");
  return { collections, isLoading, error, mutate };
}

// ── useMembershipOnchain ──────────────────────────────────────────────────────
// Per-tier on-chain record via get_membership(token_id) — supply, minted count,
// validity window, royalty. Failover-covered read provider + SWR, same pattern
// as use-tickets. Returns null while loading or if the tier doesn't exist.

export interface MembershipOnchain {
  maxSupply: bigint;
  minted: bigint;
  startTime: number | null;
  endTime: number | null;
  royaltyBps: number;
}

function parseOption(v: any): number | null {
  if (v == null) return null;
  // starknet.js parses Option<u64> as CairoOption ({ Some }, unwrap()) or undefined for None.
  if (typeof v === "object" && typeof v.unwrap === "function") {
    const inner = v.unwrap();
    return inner != null ? Number(inner) : null;
  }
  if (typeof v === "bigint" || typeof v === "number") return Number(v);
  return null;
}

async function readMembership(contract: string, tokenId: string): Promise<MembershipOnchain> {
  const col = new Contract({
    abi: IPClubCollectionABI as any,
    address: contract,
    providerOrAccount: starknetProvider,
  });
  const m: any = await col.call("get_membership", [cairo.uint256(tokenId)]);
  return {
    maxSupply: BigInt(m.max_supply),
    minted: BigInt(m.minted),
    startTime: parseOption(m.start_time),
    endTime: parseOption(m.end_time),
    royaltyBps: Number(m.royalty_bps),
  };
}

// ── useMembershipList ─────────────────────────────────────────────────────────
// All membership tiers in a club, straight from the chain. Tier ids are
// sequential from 1 and there is no count getter, so we probe get_membership
// until the first miss (capped). This includes tiers that have never been
// minted — which the indexer can't know about yet.

export interface MembershipListItem extends MembershipOnchain {
  id: string;
}

const MEMBERSHIP_PROBE_CAP = 64;

async function readMembershipList(contract: string): Promise<MembershipListItem[]> {
  const memberships: MembershipListItem[] = [];
  for (let id = 1; id <= MEMBERSHIP_PROBE_CAP; id++) {
    try {
      const m = await readMembership(contract, String(id));
      memberships.push({ id: String(id), ...m });
    } catch {
      break; // sequential ids — first miss is the end
    }
  }
  return memberships;
}

// ── predictNextMembershipId ───────────────────────────────────────────────────
// Ids are assigned sequentially on-chain starting at 1, and only the collection
// owner can ever call create_membership. That means the caller minting a new
// tier can safely predict its id ahead of time (current count + 1) and bundle
// create_membership + mint into ONE multicall — one wallet signature instead of
// two separate transactions for what is, from the creator's point of view, a
// single "create a membership" action.

export async function predictNextMembershipId(contract: string): Promise<number> {
  const memberships = await readMembershipList(contract);
  if (memberships.length >= MEMBERSHIP_PROBE_CAP) {
    // The probe capped out, so the next id can't be known reliably — minting
    // against a guessed id could land supply in an existing tier.
    throw new Error("This club has reached the maximum number of membership tiers supported by the app.");
  }
  return memberships.length + 1;
}

export function useMembershipList(contract: string | null) {
  const { data, error, isLoading, mutate } = useSWR<MembershipListItem[]>(
    contract ? `membership-list-${contract}` : null,
    () => readMembershipList(contract!),
    { revalidateOnFocus: false, dedupingInterval: 15_000 }
  );

  return { memberships: data ?? [], isLoading, error, mutate };
}

export function useMembershipOnchain(contract: string | null, tokenId: string | null) {
  const { data, error, isLoading } = useSWR<MembershipOnchain>(
    contract && tokenId ? `membership-onchain-${contract}-${tokenId}` : null,
    () => readMembership(contract!, tokenId!),
    { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 30_000 }
  );

  return { membership: data ?? null, isLoading, error };
}

// ── useIsMemberOf ─────────────────────────────────────────────────────────────
// On-chain member check for one tier — true iff the holder has balance > 0
// AND the current time is inside the tier's validity window.

export function useIsMemberOf(
  contract: string | null,
  tokenId: string | null,
  wallet: string | null
) {
  const key =
    contract && tokenId && wallet ? `is-member-of-${contract}-${tokenId}-${wallet}` : null;

  const { data, error, isLoading } = useSWR<boolean>(
    key,
    async () => {
      const col = new Contract({
        abi: IPClubCollectionABI as any,
        address: contract!,
        providerOrAccount: starknetProvider,
      });
      return Boolean(await col.call("is_member_of", [cairo.uint256(tokenId!), wallet!]));
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { isMember: data ?? false, isLoading, error };
}
