"use client";

import * as ui from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export type { TierOnchain as MembershipOnchain, TierListItem as MembershipListItem } from "@medialane/ui";

export const predictNextMembershipId = (contract: string) => ui.predictNextMembershipId(getMedialaneClient().api, contract);
export const useMyClubCollections = (owner: string | null) => ui.useMyClubCollections(getMedialaneClient, owner);
export const useMembershipList = (contract: string | null) => ui.useMembershipList(getMedialaneClient, contract);
export const useMembershipOnchain = (contract: string | null, tokenId: string | null) =>
  ui.useMembershipOnchain(getMedialaneClient, contract, tokenId);
export const useIsMemberOf = (contract: string | null, tokenId: string | null, wallet: string | null) =>
  ui.useIsMemberOf(getMedialaneClient, contract, tokenId, wallet);
