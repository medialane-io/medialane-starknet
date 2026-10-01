export const OPEN_LICENSES = ["CC0", "CC BY", "CC BY-SA", "CC BY-NC"] as const;

export type { RemixOfferStatus } from "@medialane/sdk";
export type { ApiRemixOffer as RemixOffer } from "@medialane/sdk";

export interface PublicRemix {
  id: string;
  remixContract: string | null;
  remixTokenId: string | null;
  licenseType: string;
  commercial: boolean;
  derivatives: boolean;
  createdAt: string;
}
