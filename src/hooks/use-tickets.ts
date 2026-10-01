"use client";

import useSWR from "swr";
import type { ApiTierOnchain } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";
import { useMedialaneClient } from "./use-medialane-client";
import { starknetProvider } from "@/lib/starknet";
import { Contract } from "starknet";
import { IPTicketCollectionABI } from "@medialane/sdk/starknet";

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

export interface TicketOnchain {
  maxSupply: bigint;
  minted: bigint;
  startTime: number | null;
  endTime: number | null;
  royaltyBps: number;
}

function toTier(data: ApiTierOnchain): TicketOnchain {
  return {
    maxSupply: BigInt(data.maxSupply),
    minted: BigInt(data.minted),
    startTime: data.startTime,
    endTime: data.endTime,
    royaltyBps: data.royaltyBps,
  };
}

async function readTicket(contract: string, tokenId: string): Promise<TicketOnchain> {
  return toTier(await getMedialaneClient().api.getTicket(contract, tokenId));
}

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
  const count = await getMedialaneClient().api.getTicketCount(contract);
  const tickets: TicketListItem[] = [];
  for (let id = 1; id <= count; id++) {
    tickets.push({ id: String(id), ...(await readTicket(contract, String(id))) });
  }
  return tickets;
}

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
