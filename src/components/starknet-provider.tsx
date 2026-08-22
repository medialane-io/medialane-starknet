"use client";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { mainnet } from "@starknet-react/chains";
import { ConnectorNotConnectedError, StarknetConfig, voyager } from "@starknet-react/core";
import { walletConnectors } from "@/lib/wallet-connectors";
import { RpcProvider } from "starknet";
import { RPC_PRIMARY_URL, RPC_BLOCK_IDENTIFIER } from "@/lib/starknet";
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

interface NetworkContextType {
  currentNetwork: 'starknet';
  networkConfig: {
    chainId: string;
    name: string;
    explorerUrl: string;
  };
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const NETWORK_DEFAULT: NetworkContextType = {
  currentNetwork: 'starknet',
  networkConfig: {
    chainId: '23448594291968334',
    name: 'Starknet',
    explorerUrl: 'https://voyager.online',
  },
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  return context ?? NETWORK_DEFAULT;
};

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  useSuppressStaleAutoConnectRejection();
  const chains = useMemo(() => [mainnet], []);

  const currentNetwork = 'starknet' as const;

  const networkConfigs = {
    starknet: {
      chainId: mainnet.id.toString(),
      name: 'Starknet',
      explorerUrl: 'https://voyager.online',
    },
  };

  const networkConfig = networkConfigs[currentNetwork];

  const providerFactory = useCallback(
    (_chain: unknown) =>
      new RpcProvider({ nodeUrl: RPC_PRIMARY_URL, blockIdentifier: RPC_BLOCK_IDENTIFIER }),
    [],
  );
  return (
    <NetworkContext.Provider value={{
      currentNetwork,
      networkConfig
    }}>
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
    </NetworkContext.Provider>
  );
}
