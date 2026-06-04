import { constants as SNconstants } from "starknet";

// Networks are identified by CHAIN, not tier ("mainnet" is ambiguous — every chain
// has one). Mainnet-only today; add real chains here when multichain ships, never testnets.
export enum ChainName {
    STARKNET = "STARKNET"
}

/**
 * 
 * @param address 
 * @returns 
 */
export const ToShortAddress = (address: string) => {
    return address.substring(0, 5) + "..." + address.substring(address.length - 4);
};

/**
 * Get friendly enum to manage chain with all extension wallet
 * @param chainId chain ID from extension wallet (SN_SEPOLIA from ArgentX, "0x0x534e5f5345504f4c4941" from web3 wallets)
 * @returns one simple enum
 */
export const GetFriendlyChainName = (chainId: string) => {
    if (chainId === SNconstants.NetworkName.SN_MAIN || chainId === SNconstants.StarknetChainId.SN_MAIN) {
        return ChainName.STARKNET;
    }
    else {
        return "Unknown";
    }
};

export const GetChainIdFromName = (chainName: ChainName) => {
    if (chainName === ChainName.STARKNET) {
        return SNconstants.StarknetChainId.SN_MAIN;
    }
    else {
        return "Unknown";
    }
};

export function toU256(value: string | number) {
  const bigIntValue = BigInt(value);
  return {
    low: (
      bigIntValue & BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
    ).toString(),
    high: (bigIntValue >> BigInt(128)).toString(),
  };
}



export function formatDate(dateString: string) {
    const date = new Date(dateString)
  
    // Check if the date is today
    const today = new Date()
    if (date.toDateString() === today.toDateString()) {
      return "Today"
    }
  
    // Check if the date is yesterday
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    }
  
    // If within the last 7 days, show the day name
    const oneWeekAgo = new Date(today)
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    if (date > oneWeekAgo) {
      return date.toLocaleDateString("en-US", { weekday: "long" })
    }
  
    // Otherwise, show the date
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

/**
 * Converts a File object to a base64 string
 * @param file The file to convert
 * @returns A promise that resolves to the base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}