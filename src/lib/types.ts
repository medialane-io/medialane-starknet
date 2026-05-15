/**
 * Local types for the dapp. The vast majority of types here were superseded
 * by @medialane/sdk's ApiToken / ApiCollection / ApiOrder types. This file
 * is the small remnant — only DisplayAsset, which use-asset.ts builds from
 * raw on-chain reads + IPFS metadata before the backend has indexed the
 * token, is still locally owned.
 */

export interface DisplayAsset {
  id: string;
  tags: string[];
  tokenId: number;
  name: string;
  author: {
    name: string;
    address: string;
    avatar: string;
    verified: boolean;
    bio: string;
    website: string;
  };
  creator: {
    name: string;
    address: string;
    avatar: string;
    verified: boolean;
    bio: string;
    website: string;
  };
  owner: {
    name: string;
    address: string;
    avatar: string;
    verified: boolean;
    acquired: string;
  };
  description: string;
  template: string;
  image: string;
  createdAt: string;
  collection: string;
  blockchain: string;
  tokenStandard: string;
  licenseType: string;
  licenseDetails: string;
  version: string;
  commercialUse: boolean;
  modifications: boolean;
  attribution: boolean;
  licenseTerms: string;
  contract: string;
  attributes: Array<{ trait_type: string; value: string }>;
  licenseInfo: {
    type: string;
    terms: string;
    allowCommercial: boolean;
    allowDerivatives: boolean;
    requireAttribution: boolean;
    royaltyPercentage: number;
  };
  ipfsCid?: string;
  type: string;
  collectionId?: string;
  nftAddress?: string;
}
