"use client";

import useSWR from "swr";
import { useMedialaneClient } from "./use-medialane-client";
import { starknetProvider } from "@/lib/starknet";
import { Contract, cairo } from "starknet";
import { IPClubCollectionABI } from "@medialane/sdk/starknet";

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

export interface MembershipOnchain {
  maxSupply: bigint;
  minted: bigint;
  startTime: number | null;
  endTime: number | null;
  royaltyBps: number;
}

async function readMembership(contract: string, tokenId: string): Promise<MembershipOnchain> {
  const res = await fetch(`/api/proxy/v1/club/${contract}/${tokenId}`);
  if (!res.ok) throw new Error("Failed to fetch membership");
  const json = await res.json();
  return {
    maxSupply: BigInt(json.data.maxSupply),
    minted: BigInt(json.data.minted),
    startTime: json.data.startTime,
    endTime: json.data.endTime,
    royaltyBps: json.data.royaltyBps,
  };
}

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
      break;
    }
  }
  return memberships;
}

async function countMembershipsOnchain(contract: string): Promise<number> {
  const col = new Contract({
    abi: IPClubCollectionABI as any,
    address: contract,
    providerOrAccount: starknetProvider,
  });
  let count = 0;
  for (let id = 1; id <= MEMBERSHIP_PROBE_CAP; id++) {
    try {
      await col.call("get_membership", [cairo.uint256(id)]);
      count += 1;
    } catch {
      break;
    }
  }
  return count;
}

export async function predictNextMembershipId(contract: string): Promise<number> {
  const count = await countMembershipsOnchain(contract);
  if (count >= MEMBERSHIP_PROBE_CAP) {

    throw new Error("This club has reached the maximum number of membership tiers supported by the app.");
  }
  return count + 1;
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
      const res = await fetch(`/api/proxy/v1/club/${contract}/${tokenId}/member/${wallet}`);
      if (!res.ok) throw new Error("Failed to fetch membership status");
      const json = await res.json();
      return Boolean(json.data.isMember);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { isMember: data ?? false, isLoading, error };
}
