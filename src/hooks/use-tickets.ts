"use client";

import useSWR from "swr";
import { useMedialaneClient } from "./use-medialane-client";
import { starknetProvider } from "@/lib/starknet";
import { Contract } from "starknet";
import { IPTicketCollectionABI } from "@medialane/sdk/starknet";

// ── useMyTicketCollections ────────────────────────────────────────────────────
// The connected creator's tickets collections (launchpad browse page).

export function useMyTicketCollections(ownerAddress: string | null) {
  const client = useMedialaneClient();

  const { data, error, isLoading, mutate } = useSWR(
    ownerAddress ? `my-ticket-collections-${ownerAddress}` : null,
    () => client.api.getCollectionsByOwner(ownerAddress!),
    { revalidateOnFocus: false }
  );

  const collections = (data?.data ?? []).filter((c) => c.service === "ip-tickets");
  return { collections, isLoading, error, mutate };
}

// ── useTicketOnchain ──────────────────────────────────────────────────────────
// Per-ticket on-chain record via get_ticket(token_id) — supply, minted count,
// validity window, royalty. Failover-covered read provider + SWR, same pattern
// as use-coin-supply. Returns null while loading or if the ticket doesn't exist.

export interface TicketOnchain {
  maxSupply: bigint;
  minted: bigint;
  startTime: number | null;
  endTime: number | null;
  royaltyBps: number;
}

async function readTicket(contract: string, tokenId: string): Promise<TicketOnchain> {
  const res = await fetch(`/api/proxy/v1/tickets/${contract}/${tokenId}`);
  if (!res.ok) throw new Error("Failed to fetch ticket");
  const json = await res.json();
  return {
    maxSupply: BigInt(json.data.maxSupply),
    minted: BigInt(json.data.minted),
    startTime: json.data.startTime,
    endTime: json.data.endTime,
    royaltyBps: json.data.royaltyBps,
  };
}

// ── useTicketList ─────────────────────────────────────────────────────────────
// All tickets in a collection, straight from the chain: one ticket_count()
// read, then get_ticket per id. Includes tickets that have never been minted —
// which the indexer can't know about yet.

export interface TicketListItem extends TicketOnchain {
  id: string;
}

async function readTicketCount(contract: string): Promise<number> {
  const col = new Contract({
    abi: IPTicketCollectionABI as any,
    address: contract,
    providerOrAccount: starknetProvider,
  });
  return Number(await col.call("ticket_count", []));
}

async function readTicketList(contract: string): Promise<TicketListItem[]> {
  const countRes = await fetch(`/api/proxy/v1/tickets/${contract}/count`);
  if (!countRes.ok) throw new Error("Failed to fetch ticket count");
  const { data } = await countRes.json();
  const count = data.count as number;
  const tickets: TicketListItem[] = [];
  for (let id = 1; id <= count; id++) {
    tickets.push({ id: String(id), ...(await readTicket(contract, String(id))) });
  }
  return tickets;
}

// ── predictNextTicketId ───────────────────────────────────────────────────────
// Ids are assigned sequentially on-chain starting at 1, and only the collection
// owner can ever call create_ticket. That means the caller minting a new ticket
// can safely predict its id ahead of time (current count + 1) and bundle
// create_ticket + mint into ONE multicall — one wallet signature instead of two
// separate transactions for what is, from the creator's point of view, a single
// "mint a ticket" action.

export async function predictNextTicketId(contract: string): Promise<number> {
  return (await readTicketCount(contract)) + 1;
}

export function useTicketList(contract: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TicketListItem[]>(
    contract ? `ticket-list-${contract}` : null,
    () => readTicketList(contract!),
    { revalidateOnFocus: false, dedupingInterval: 15_000 }
  );

  return { tickets: data ?? [], isLoading, error, mutate };
}

export function useTicketOnchain(contract: string | null, tokenId: string | null) {
  const { data, error, isLoading } = useSWR<TicketOnchain>(
    contract && tokenId ? `ticket-onchain-${contract}-${tokenId}` : null,
    () => readTicket(contract!, tokenId!),
    { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 30_000 }
  );

  return { ticket: data ?? null, isLoading, error };
}
