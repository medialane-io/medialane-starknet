"use client";

import {
  getDropStatus,
  useDropCollections as useDropCollectionsBase,
  useMyDrops as useMyDropsBase,
  useDropMintStatus as useDropMintStatusBase,
  useDropInfo as useDropInfoBase,
  useOnChainDropState as useOnChainDropStateBase,
  type DropConditions,
  type DropStatus,
} from "@medialane/ui";
import type { ApiDropInfo, ApiDropState, DropMintStatus } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";

export { getDropStatus };
export type { DropConditions, DropStatus, DropMintStatus, ApiDropInfo };
export type OnChainDropState = ApiDropState;

export const useDropCollections = () => useDropCollectionsBase(getMedialaneClient);
export const useMyDrops = (owner: string | null) => useMyDropsBase(getMedialaneClient, owner);
export const useDropMintStatus = (collection: string | null, wallet: string | null) =>
  useDropMintStatusBase(getMedialaneClient, collection, wallet);
export const useDropInfo = (contract: string | null) => useDropInfoBase(getMedialaneClient, contract);
export const useOnChainDropState = (contract: string | null) => useOnChainDropStateBase(getMedialaneClient, contract);
