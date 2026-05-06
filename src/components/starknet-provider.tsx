"use client";
import { createContext, useContext, useMemo } from "react";
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  useInjectedConnectors,
  voyager,
  avnuPaymasterProvider,
} from "@starknet-react/core";
import { RpcProvider } from "starknet";
import { idResolvedBraavos, idResolvedReady } from "@/lib/starknet-connectors";

interface NetworkContextType {
  currentNetwork: 'mainnet' | 'sepolia';
  networkConfig: {
    chainId: string;
    name: string;
    explorerUrl: string;
  };
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const NETWORK_DEFAULT: NetworkContextType = {
  currentNetwork: 'mainnet',
  networkConfig: {
    chainId: '23448594291968334',
    name: 'Starknet Mainnet',
    explorerUrl: 'https://voyager.online',
  },
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  return context ?? NETWORK_DEFAULT;
};

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const recommendedConnectors = useMemo(
    () => [idResolvedReady(), idResolvedBraavos()],
    [],
  );

  const { connectors } = useInjectedConnectors({
    recommended: recommendedConnectors,
    includeRecommended: "always",
    order: "alphabetical",
  });

  // Determine network from environment variable, default to mainnet
  const networkEnv = process.env.NEXT_PUBLIC_STARKNET_NETWORK === 'sepolia' ? 'sepolia' : 'mainnet';
  const currentNetwork = networkEnv;

  const networkConfigs = {
    mainnet: {
      chainId: mainnet.id.toString(),
      name: 'Starknet Mainnet',
      explorerUrl: 'https://voyager.online'
    },
    sepolia: {
      chainId: sepolia.id.toString(),
      name: 'Starknet Sepolia',
      explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://voyager.online'
    }
  };

  // Get current network config
  const networkConfig = networkConfigs[currentNetwork];

  // Retrieve your custom RPC URL from environment variables
  const customRpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

  const providerFactory = (chain: any) => new RpcProvider({ nodeUrl: customRpcUrl || "" });

  return (
    <NetworkContext.Provider value={{
      currentNetwork,
      networkConfig
    }}>
      <StarknetConfig
        chains={[mainnet, sepolia]}
        provider={providerFactory}
        connectors={connectors}
        explorer={voyager}
        defaultChainId={currentNetwork === 'mainnet' ? mainnet.id : sepolia.id}
        autoConnect={true}
        paymasterProvider={avnuPaymasterProvider({
          apiKey: process.env.NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY,
        })}
      >
        {children}
      </StarknetConfig>
    </NetworkContext.Provider>
  );
}
