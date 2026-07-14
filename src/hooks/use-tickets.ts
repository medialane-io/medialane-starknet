"use client";

import useSWR from "swr";
import { useMedialaneClient } from "./use-medialane-client";
import { MEDIALANE_BACKEND_URL } from "@/lib/constants";
import { starknetProvider } from "@/lib/starknet";
import { Contract, cairo } from "starknet";
import { IPTicketCollectionABI } from "@medialane/sdk";

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

async function readTicket(contract: string, tokenId: string): Promise<TicketOnchain> {
  const col = new Contract({
    abi: IPTicketCollectionABI as any,
    address: contract,
    providerOrAccount: starknetProvider,
  });
  const t: any = await col.call("get_ticket", [cairo.uint256(tokenId)]);
  return {
    maxSupply: BigInt(t.max_supply),
    minted: BigInt(t.minted),
    startTime: parseOption(t.start_time),
    endTime: parseOption(t.end_time),
    royaltyBps: Number(t.royalty_bps),
  };
}

// ── useTicketList ─────────────────────────────────────────────────────────────
// All tickets in a collection, straight from the chain. Ticket ids are
// sequential from 1 and there is no count getter, so we probe get_ticket until
// the first miss (capped). This includes tickets that have never been minted —
// which the indexer can't know about yet.

export interface TicketListItem extends TicketOnchain {
  id: string;
}

const TICKET_PROBE_CAP = 64;

async function readTicketList(contract: string): Promise<TicketListItem[]> {
  const tickets: TicketListItem[] = [];
  for (let id = 1; id <= TICKET_PROBE_CAP; id++) {
    try {
      const t = await readTicket(contract, String(id));
      tickets.push({ id: String(id), ...t });
    } catch {
      break; // sequential ids — first miss is the end
    }
  }
  return tickets;
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

// ── useTicketValidity ─────────────────────────────────────────────────────────
// On-chain door check via the backend — true iff the holder has balance > 0
// AND the current time is inside the ticket's validity window.

export function useTicketValidity(
  contractAddress: string | null,
  tokenId: string | null,
  wallet: string | null
) {
  const key =
    contractAddress && tokenId && wallet
      ? `ticket-validity-${contractAddress}-${tokenId}-${wallet}`
      : null;

  const { data, error, isLoading } = useSWR<{ data: { valid: boolean } }>(
    key,
    async () => {
      const base = MEDIALANE_BACKEND_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/v1/tickets/${contractAddress}/${tokenId}/validity/${wallet}`);
      if (!res.ok) throw new Error(`Ticket validity check failed: ${res.status}`);
      return res.json();
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { valid: data?.data?.valid ?? false, isLoading, error };
}
