"use client";
import { useCallback, useEffect } from "react";
import { mainnet } from "@starknet-react/chains";
import { ConnectorNotConnectedError, StarknetConfig, voyager } from "@starknet-react/core";
import { walletConnectors } from "@/lib/wallet-connectors";
import { getMedialaneClient } from "@/lib/medialane-client";
import { EXPLORER_URL } from "@/lib/constants";
import { QueryClient } from "@tanstack/react-query";

function useSuppressStaleAutoConnectRejection(): void {
  useEffect(() => {
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (event.reason instanceof ConnectorNotConnectedError) {
        event.preventDefault();
      }
    }
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 10_000,
    },
  },
});

export const NETWORK = {
  chainId: mainnet.id.toString(),
  name: "Starknet",
  explorerUrl: EXPLORER_URL,
};

const chains = [mainnet];

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  useSuppressStaleAutoConnectRejection();

  const providerFactory = useCallback((_chain: unknown) => getMedialaneClient().provider, []);
  return (
    <StarknetConfig
      chains={chains}
      provider={providerFactory}
      connectors={walletConnectors}
      explorer={voyager}
      queryClient={queryClient}
      defaultChainId={mainnet.id}
      autoConnect={true}
    >
      {children}
    </StarknetConfig>
  );
}
