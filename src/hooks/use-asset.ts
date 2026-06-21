"use client";

import { useMemo, useState, useRef } from "react";
import { useContract } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import type { Abi } from "starknet";
import { IPNftABI as COLLECTION_NFT_ABI } from "@medialane/sdk";
import {
  fetchIPFSMetadata,
  processIPFSHashToUrl,
  IPFSMetadata,
} from "@/utils/ipfs";
import { DisplayAsset } from "@/lib/types";

export interface AssetDetail {
  id: string; // `${nftAddress}-${tokenId}`
  name: string;
  description?: string;
  image?: string;
  type?: string;
  registrationDate?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  properties?: Record<string, unknown>;
  external_url?: string;
  collectionId?: string;
  collectionName?: string;
  nftAddress: `0x${string}`;
  tokenId: number;
  owner?: `0x${string}`;
  tokenURI?: string;
  ipfsCid?: string;
  tags?: string[];
  licenseType?: string;
}

export interface LoadingState {
  isInitializing: boolean;
  isFetchingOnchainData: boolean;
  isFetchingMetadata: boolean;
  isComplete: boolean;
  currentStep: string;
  progress: number; // 0-100
}

export function useAsset(nftAddress?: `0x${string}`, tokenIdInput?: number) {
  // We keep a local state for granular loading progress since useQuery doesn't track steps
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isInitializing: false,
    isFetchingOnchainData: false,
    isFetchingMetadata: false,
    isComplete: false,
    currentStep: "",
    progress: 0,
  });

  // Tracks the active query run ID so state updates from stale async runs are ignored.
  const activeRunRef = useRef<string | null>(null);

  const { contract } = useContract({
    abi: COLLECTION_NFT_ABI as unknown as Abi,
    address: (nftAddress as `0x${string}`) || undefined,
  });

  const currentId = nftAddress && tokenIdInput != null ? `${nftAddress}-${Number(tokenIdInput)}` : null;

  const fetchAssetDetails = async () => {
    if (!nftAddress || tokenIdInput === undefined || !contract) {
      throw new Error("Missing required parameters for fetching asset");
    }

    const tokenId = Number(tokenIdInput);

    // Tag this execution so stale runs from a previous queryKey don't overwrite state.
    const runId = `${nftAddress}-${tokenId}-${Date.now()}`;
    activeRunRef.current = runId;
    const isCurrentRun = () => activeRunRef.current === runId;

    const safeSetLoadingState = (update: Parameters<typeof setLoadingState>[0]) => {
      if (isCurrentRun()) setLoadingState(update);
    };

    safeSetLoadingState({
      isInitializing: true,
      isFetchingOnchainData: false,
      isFetchingMetadata: false,
      isComplete: false,
      currentStep: "Loading asset...",
      progress: 10,
    });

    try {
      // Step 1: Fetch onchain data
      safeSetLoadingState((prev) => ({
        ...prev,
        isInitializing: false,
        isFetchingOnchainData: true,
        currentStep: "Fetching onchain data...",
        progress: 30,
      }));

      const onchainTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 15000)
      );

      const fetchWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> => {
        let lastErr;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await fn();
          } catch (e: any) {
            lastErr = e;
            // If not rate limit error, and not "entrypoint does not exist" - just wait and retry.
            await new Promise(r => setTimeout(r, 600 * Math.pow(2, attempt)));
          }
        }
        throw lastErr;
      };

      const safeCall = async (methods: string[], args: any[] = []) => {
        const method = methods.find(m => typeof (contract as any)[m] === "function");
        if (!method) return undefined;
        return fetchWithRetry(() => (contract as any)[method](...args));
      };

      const onchainData = (await Promise.race([
        (async () => {
          // owner
          const ownerRaw = await safeCall(["owner_of", "ownerOf"], [tokenId]).catch(() => undefined);
          let owner: `0x${string}` | undefined;
          if (ownerRaw) {
            try {
              owner = `0x${BigInt(ownerRaw as any).toString(16)}` as `0x${string}`;
            } catch (e) {
              console.warn("Error parsing owner:", e);
            }
          }

          // token URI
          const uriRaw = await safeCall(["token_uri", "tokenURI"], [tokenId]).catch(() => undefined);
          const tokenURI = String(uriRaw || "");

          // collection & name
          const collectionIdRaw = await safeCall(["get_collection_id", "getCollectionId"]).catch(() => null);
          const contractNameRaw = await safeCall(["name"]).catch(() => null);

          return {
            owner,
            tokenURI,
            collectionId: collectionIdRaw ? String(collectionIdRaw) : undefined,
            contractName: contractNameRaw ? String(contractNameRaw) : undefined
          };
        })(),
        onchainTimeout,
      ])) as { owner: `0x${string}`; tokenURI: string; collectionId?: string; contractName?: string };

      // Step 2: Fetch IPFS metadata
      safeSetLoadingState((prev) => ({
        ...prev,
        isFetchingOnchainData: false,
        isFetchingMetadata: true,
        currentStep: "Fetching metadata...",
        progress: 60,
      }));

      let ipfsCid: string | undefined;
      let metadata: IPFSMetadata | null = null;

      if (onchainData.tokenURI) {
        let cid = "";
        const uri = onchainData.tokenURI;

        if (uri.startsWith("ipfs://")) cid = uri.replace("ipfs://", "");
        else if (uri.includes("/ipfs/")) cid = uri.split("/ipfs/")[1]?.split("?")[0] || "";
        else if (uri.match(/^[a-zA-Z0-9]{46,59}$/)) cid = uri;

        if (cid) {
          ipfsCid = cid;
          const metadataTimeout = new Promise<IPFSMetadata | null>(
            (_, reject) => setTimeout(() => reject(new Error("Metadata timeout")), 10000)
          );

          try {
            metadata = await Promise.race([fetchIPFSMetadata(cid), metadataTimeout]);
          } catch (metadataError) {
            console.warn("Failed to fetch IPFS metadata:", metadataError);
          }
        }
      }

      // Step 3: Process and combine
      safeSetLoadingState((prev) => ({
        ...prev,
        isFetchingMetadata: false,
        currentStep: "Almost ready...",
        progress: 90,
      }));

      const finalAsset: AssetDetail = {
        id: currentId!,
        nftAddress,
        tokenId,
        name: (metadata?.name as string) || `IP Asset #${tokenId}`,
        description: (metadata?.description as string) || "",
        image: processIPFSHashToUrl((metadata?.image as string) || "", "/placeholder.svg"),
        type: (metadata?.type as string) || (metadata?.assetType as string | undefined),
        registrationDate: metadata?.registrationDate as string | undefined,
        attributes: (() => {
          const attrs = (metadata?.attributes as Array<{ trait_type: string; value: string; }>) || [];
          if (!attrs.length) return undefined;
          const seen = new Set();
          return attrs.filter(attr => {
            const key = attr.trait_type?.toLowerCase?.() || String(attr.trait_type);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        })(),
        properties: metadata?.properties || undefined,
        external_url: metadata?.external_url || undefined,
        owner: onchainData.owner,
        tokenURI: onchainData.tokenURI,
        ipfsCid,
        tags: metadata?.tags as string[] | undefined,
        collectionName: (metadata?.collectionName as string) || onchainData.contractName,
        licenseType: metadata?.licenseType as string | undefined,
        collectionId: onchainData.collectionId || metadata?.collection as string | undefined,
      };

      safeSetLoadingState((prev) => ({
        ...prev,
        isComplete: true,
        currentStep: "Ready!",
        progress: 100,
      }));

      return finalAsset;

    } catch (e: any) {
      const isNotFound = /erc721:\s*invalid\s*token\s*id/i.test(e?.message || "");
      if (isNotFound) {
        safeSetLoadingState((prev) => ({
          ...prev,
          isComplete: true,
          currentStep: "Asset not found",
          progress: 100,
        }));
        throw new Error("NOT_FOUND"); // Special error string we check later
      }

      safeSetLoadingState((prev) => ({
        ...prev,
        isComplete: false,
        currentStep: "Error occurred",
        progress: 0,
      }));
      throw e;
    }
  };

  const {
    data: asset,
    isLoading,
    isError,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: ["asset", currentId],
    queryFn: fetchAssetDetails,
    enabled: !!currentId && !!contract,
    retry: (failureCount, error: any) => {
      if (error?.message === "NOT_FOUND") return false;
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(800 * 2 ** attemptIndex, 8000), // Exponential backoff
    staleTime: 30000, // 30 seconds
  });

  const isNotFound = queryError?.message === "NOT_FOUND";
  const errorMessage = isNotFound ? null : queryError?.message || null;

  const displayAsset = useMemo(() => {
    if (!asset) return null;

    const tokenOwnerAddress = asset.owner
      ? "0x" + BigInt(asset.owner).toString(16)
      : "Unknown";

    const getAttr = (name: string) => asset.attributes?.find(a => a.trait_type?.toLowerCase() === name)?.value;

    const creator = asset.properties?.creator || tokenOwnerAddress;
    const collection = asset.properties?.collection || asset.collectionName || getAttr("collection") || asset.collectionId || "";

    return {
      id: asset.id,
      tokenId: asset.tokenId,
      name: asset.name || "Untitled",
      tags: asset.tags || [],
      author: {
        name: creator,
        address: tokenOwnerAddress,
        avatar: asset.image || "/background.jpg",
        verified: false,
        bio: "",
        website: asset.external_url || "https://starknet.medialane.io",
      },
      creator: {
        name: creator,
        address: tokenOwnerAddress,
        avatar: asset.image || "/background.jpg",
        verified: false,
        bio: "",
        website: asset.external_url || "https://starknet.medialane.io",
      },
      owner: {
        name: tokenOwnerAddress,
        address: tokenOwnerAddress,
        avatar: "/background.jpg",
        verified: true,
        acquired: "(Preview)",
      },
      description: asset.description || "",
      template: asset.type || "Asset",
      image: asset.image || "/background.jpg",
      createdAt: asset.registrationDate || asset.properties?.registration_date || new Date().toLocaleDateString(),
      collection: collection || "IP Collection",
      blockchain: "Starknet",
      tokenStandard: "ERC-721",
      licenseType: asset.licenseType || getAttr("type") || "",
      licenseDetails: "Unknown",
      version: getAttr("ip version") || "1.0",
      commercialUse: getAttr("commercial use") === "true",
      modifications: getAttr("modifications") === "true",
      attribution: getAttr("attribution") === "true",
      licenseTerms: getAttr("license") || "Unknown",
      contract: (asset.nftAddress as string) || "",
      attributes: asset.attributes || [
        { trait_type: "Asset", value: "Programmable IP" },
        { trait_type: "Protection", value: "Proof of Ownership" },
      ],
      licenseInfo: {
        type: getAttr("type") || asset.licenseType || "Unknown",
        terms: getAttr("license") || "Unknown",
        allowCommercial: getAttr("commercial use") === "true",
        allowDerivatives: getAttr("modifications") === "true",
        requireAttribution: getAttr("attribution") === "true",
        royaltyPercentage: 5,
      },
      ipfsCid: asset.ipfsCid,
      type: asset.type || getAttr("type") || "",
    } as DisplayAsset;
  }, [asset]);

  const uiState = useMemo<"loading" | "ready" | "not_found" | "error">(() => {
    if (isNotFound) return "not_found";
    if (isLoading || (!asset && !isError)) return "loading";
    if (isError) return "error";
    return "ready";
  }, [isNotFound, isLoading, isError, asset]);

  return useMemo(
    () => ({
      asset: asset || null,
      displayAsset,
      loading: uiState === "loading",
      loadingState,
      error: errorMessage,
      notFound: isNotFound,
      uiState,
      showSkeleton: uiState === "loading",
      reload: refetch,
    }),
    [asset, displayAsset, uiState, loadingState, errorMessage, isNotFound, refetch]
  );
}

export type { DisplayAsset };
