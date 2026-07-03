"use client";

/**
 * useSwap — token swap hook, routed directly on Ekubo via StarkZap.
 *
 * The memecoin / creator-coin pools live on Ekubo (concentrated-liquidity AMM),
 * so we quote and route straight against Ekubo through StarkZap's
 * `EkuboSwapProvider` — no AVNU aggregator in the middle (and no AVNU
 * integrator fee). StarkZap's `prepareSwap` returns ready-to-execute Starknet
 * `Call[]` (approve + swap), which we run through the app's unified
 * wallet/paymaster pipeline — so it works for every wallet type (injected
 * Argent/Braavos, Cartridge, Privy), not just StarkZap-native wallets.
 *
 * Lifecycle: token+amount selection → debounced Ekubo quote → prepareSwap →
 * execute via unified wallet.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { EkuboSwapProvider, type SwapQuote, type SwapRequest } from "starkzap";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useToast } from "@/hooks/use-toast";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { Amount, fromAddress, APP_CHAIN_ID, type Token as SzToken, type StarkZapTokenKey } from "@/lib/starkzap";
import {
  formatTokenAmount,
  parseTokenAmount,
  SWAP_TOKENS,
  type SwapToken,
} from "@/utils/swap-tokens";

export type { SwapToken };
export { SWAP_TOKENS };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSwapReturn {
  // Token selection
  sellToken: SwapToken;
  buyToken: SwapToken;
  setSellToken: (token: SwapToken) => void;
  setBuyToken: (token: SwapToken) => void;
  flipTokens: () => void;

  // Amounts
  sellAmount: string;
  buyAmount: string;
  setSellAmount: (value: string) => void;

  // Quote
  quote: SwapQuote | null;
  isFetchingQuote: boolean;
  quoteError: string | null;

  // Balances
  sellBalance: string | null;
  buyBalance: string | null;
  isSellBalanceLoading: boolean;

  // Price info
  priceImpact: string | null;
  exchangeRate: string | null;
  /** Minimum the user is guaranteed to receive after slippage (human units). */
  minBuyAmount: string | null;

  // Slippage tolerance (fraction, e.g. 0.005 = 0.5%)
  slippage: number;
  setSlippage: (value: number) => void;

  // Execution
  executeSwap: () => Promise<string | null>;
  isExecuting: boolean;
  txHash: string | null;
  execError: string | null;

  // Validation
  insufficientBalance: boolean;
  canSwap: boolean;
}

// ---------------------------------------------------------------------------
// Ekubo provider (singleton) + helpers
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 500;

// Stateless provider — quotes via Ekubo's quoter, builds calls via the Ekubo
// router preset. Safe to instantiate once at module scope.
const ekubo = new EkuboSwapProvider();

/** App SwapToken → StarkZap Token (the swap request shape). */
function toSzToken(t: SwapToken): SzToken {
  return { name: t.name, symbol: t.symbol, address: fromAddress(t.address), decimals: t.decimals };
}

function buildRequest(
  sell: SwapToken,
  buy: SwapToken,
  rawAmount: bigint,
  slippage: number,
  takerAddress?: string
): SwapRequest {
  return {
    chainId: APP_CHAIN_ID,
    takerAddress: takerAddress ? fromAddress(takerAddress) : undefined,
    tokenIn: toSzToken(sell),
    tokenOut: toSzToken(buy),
    amountIn: Amount.fromRaw(rawAmount, toSzToken(sell)),
    slippageBps: BigInt(Math.round(slippage * 10_000)),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSwap(): UseSwapReturn {
  const { address, execute } = useUnifiedWallet();
  const { toast } = useToast();

  const [sellToken, setSellTokenState] = useState<SwapToken>(SWAP_TOKENS[0]); // ETH
  const [buyToken, setBuyTokenState] = useState<SwapToken>(SWAP_TOKENS[2]); // USDC
  const [sellAmount, setSellAmountState] = useState("");
  const [buyAmount, setBuyAmount] = useState("");

  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(0.005); // 0.5% default

  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Balances -----------------------------------------------------------

  // StarkZap balance hook only supports STRK/ETH/USDC/USDT
  const BALANCE_TOKENS = new Set<string>(["STRK", "ETH", "USDC", "USDT"]);
  const sellBalanceKey = BALANCE_TOKENS.has(sellToken.symbol)
    ? (sellToken.symbol as StarkZapTokenKey)
    : "ETH"; // fallback key — result is ignored when symbol not in set
  const buyBalanceKey = BALANCE_TOKENS.has(buyToken.symbol)
    ? (buyToken.symbol as StarkZapTokenKey)
    : "ETH";

  const sellBalanceHook = useTokenBalance(sellBalanceKey, address);
  const buyBalanceHook = useTokenBalance(buyBalanceKey, address);

  const sellBalance = BALANCE_TOKENS.has(sellToken.symbol) ? sellBalanceHook.raw : null;
  const buyBalance = BALANCE_TOKENS.has(buyToken.symbol) ? buyBalanceHook.raw : null;

  const sellBalanceFormatted = sellBalance !== null
    ? formatTokenAmount(sellBalance, sellToken.decimals)
    : null;
  const buyBalanceFormatted = buyBalance !== null
    ? formatTokenAmount(buyBalance, buyToken.decimals)
    : null;

  // ---- Quote fetching -----------------------------------------------------

  const fetchQuote = useCallback(async (
    sell: SwapToken,
    buy: SwapToken,
    amount: string,
    slip: number,
    takerAddress?: string
  ) => {
    const parsed = parseTokenAmount(amount, sell.decimals);
    if (parsed <= 0n) {
      setQuote(null);
      setBuyAmount("");
      setQuoteError(null);
      return;
    }

    setIsFetchingQuote(true);
    setQuoteError(null);

    try {
      const q = await ekubo.getQuote(buildRequest(sell, buy, parsed, slip, takerAddress));
      if (!q || q.amountOutBase <= 0n) {
        setQuote(null);
        setBuyAmount("");
        setQuoteError("No route found for this pair");
        return;
      }
      setQuote(q);
      setBuyAmount(formatTokenAmount(q.amountOutBase, buy.decimals));
    } catch (err) {
      setQuote(null);
      setBuyAmount("");
      setQuoteError(err instanceof Error ? err.message : "No route found for this pair");
    } finally {
      setIsFetchingQuote(false);
    }
  }, []);

  // Debounced re-quote whenever inputs change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchQuote(sellToken, buyToken, sellAmount, slippage, address);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sellToken, buyToken, sellAmount, slippage, address, fetchQuote]);

  // ---- Token setters that clear the stale quote ---------------------------

  const setSellToken = useCallback((token: SwapToken) => {
    if (token.symbol === buyToken.symbol) {
      setBuyTokenState(sellToken);
    }
    setSellTokenState(token);
    setQuote(null);
    setBuyAmount("");
  }, [buyToken, sellToken]);

  const setBuyToken = useCallback((token: SwapToken) => {
    if (token.symbol === sellToken.symbol) {
      setSellTokenState(buyToken);
    }
    setBuyTokenState(token);
    setQuote(null);
    setBuyAmount("");
  }, [sellToken, buyToken]);

  const flipTokens = useCallback(() => {
    setSellTokenState(buyToken);
    setBuyTokenState(sellToken);
    setSellAmountState(buyAmount);
    setBuyAmount(sellAmount);
    setQuote(null);
  }, [sellToken, buyToken, sellAmount, buyAmount]);

  const setSellAmount = useCallback((value: string) => {
    // Allow only valid numeric input
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setSellAmountState(value);
    if (!value) {
      setQuote(null);
      setBuyAmount("");
    }
  }, []);

  // ---- Price info ---------------------------------------------------------

  const priceImpact = quote?.priceImpactBps != null
    ? `${(Number(quote.priceImpactBps) / 100).toFixed(2)}%`
    : null;

  const minBuyAmount = buyAmount
    ? (() => {
        const n = parseFloat(buyAmount) * (1 - slippage);
        if (!Number.isFinite(n) || n <= 0) return null;
        return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
      })()
    : null;

  const exchangeRate = quote && sellAmount
    ? (() => {
        const sellRaw = parseTokenAmount(sellAmount, sellToken.decimals);
        if (sellRaw === 0n) return null;
        // rate = amountOut / amountIn, adjusted for decimal difference
        const decimalAdj = sellToken.decimals - buyToken.decimals;
        const scaledBuy = decimalAdj >= 0
          ? quote.amountOutBase * 10n ** BigInt(decimalAdj)
          : quote.amountOutBase / 10n ** BigInt(-decimalAdj);
        const rate = Number(scaledBuy) / Number(sellRaw);
        return `1 ${sellToken.symbol} ≈ ${rate.toFixed(4)} ${buyToken.symbol}`;
      })()
    : null;

  // ---- Validation ---------------------------------------------------------

  const sellAmountRaw = parseTokenAmount(sellAmount, sellToken.decimals);

  const insufficientBalance =
    sellBalance !== null &&
    sellAmountRaw > 0n &&
    sellAmountRaw > sellBalance;

  const canSwap =
    !!address &&
    !!quote &&
    sellAmountRaw > 0n &&
    !insufficientBalance &&
    !isFetchingQuote &&
    !isExecuting;

  // ---- Execution ----------------------------------------------------------

  const executeSwap = useCallback(async (): Promise<string | null> => {
    if (!address) return null;

    setIsExecuting(true);
    setExecError(null);

    try {
      // Build fresh calls from Ekubo (approve + swap) for the current input.
      const prepared = await ekubo.prepareSwap(
        buildRequest(sellToken, buyToken, sellAmountRaw, slippage, address)
      );
      if (!prepared.calls.length) throw new Error("No route available — please try again");

      toast({
        title: "Confirm swap",
        description: `Swapping ${sellAmount} ${sellToken.symbol} → ${buyAmount} ${buyToken.symbol}`,
      });

      const hash = await execute(prepared.calls);
      setTxHash(hash);
      toast({ title: "Swap submitted", description: "Your swap is being processed on-chain." });

      // Reset after success
      setSellAmountState("");
      setBuyAmount("");
      setQuote(null);

      return hash;
    } catch (err) {
      console.error("[swap] error:", err);
      const msg = getFriendlyWalletError(err).message;
      setExecError(msg);
      toast({ title: "Swap failed", description: msg, variant: "destructive" });
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, [address, sellToken, buyToken, sellAmount, buyAmount, sellAmountRaw, slippage, execute, toast]);

  return {
    sellToken,
    buyToken,
    setSellToken,
    setBuyToken,
    flipTokens,
    sellAmount,
    buyAmount,
    setSellAmount,
    quote,
    isFetchingQuote,
    quoteError,
    sellBalance: sellBalanceFormatted,
    buyBalance: buyBalanceFormatted,
    isSellBalanceLoading: BALANCE_TOKENS.has(sellToken.symbol) ? sellBalanceHook.isLoading : false,
    priceImpact,
    exchangeRate,
    minBuyAmount,
    slippage,
    setSlippage,
    executeSwap,
    isExecuting,
    txHash,
    execError,
    insufficientBalance,
    canSwap,
  };
}
