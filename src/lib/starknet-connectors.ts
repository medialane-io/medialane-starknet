"use client";

import {
  Connector,
  ConnectorNotConnectedError,
  ConnectorNotFoundError,
  UserRejectedRequestError,
} from "@starknet-react/core";
import type {
  AccountInterface,
  PaymasterInterface,
  ProviderInterface,
} from "starknet";
import { num, WalletAccount } from "starknet";

type WalletIcon = string | { dark: string; light: string };

type StarknetWallet = {
  id: string;
  name?: string;
  icon?: WalletIcon;
  request: (call: { type: string; params?: unknown }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off?: (event: string, handler: (...args: any[]) => void) => void;
};

type ConnectorResult = {
  account?: string;
  chainId?: bigint;
};

const UNKNOWN_WALLET_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17.25h.008v.008H12v-.008z'/%3E%3C/svg%3E";

function isStarknetWallet(value: unknown): value is StarknetWallet {
  const wallet = value as Partial<StarknetWallet> | null;

  return Boolean(
    wallet &&
      typeof wallet.id === "string" &&
      typeof wallet.request === "function" &&
      typeof wallet.on === "function",
  );
}

function resolveInjectedWallet(id: string): StarknetWallet | undefined {
  const globalObject = globalThis as Record<string, unknown>;
  const exact = globalObject[`starknet_${id}`];

  if (isStarknetWallet(exact) && exact.id === id) return exact;

  for (const key of Object.getOwnPropertyNames(globalObject)) {
    const wallet = globalObject[key];
    if (key.startsWith("starknet") && isStarknetWallet(wallet) && wallet.id === id) {
      return wallet;
    }
  }
}

// @starknet-react/core discovers injected wallets by scanning window, but its
// built-in connector resolves them later via window.starknet_${id}. Braavos and
// some extension versions can be discoverable under a different window key, so
// this adapter keeps the same connector behavior while resolving by wallet.id.
class IdResolvedInjectedConnector extends Connector {
  private wallet?: StarknetWallet;

  constructor(
    private readonly walletId: string,
    private readonly fallbackName: string,
  ) {
    super();
  }

  get id() {
    return this.walletId;
  }

  get name() {
    return this.currentWallet()?.name ?? this.fallbackName;
  }

  get icon() {
    return this.currentWallet()?.icon ?? UNKNOWN_WALLET_ICON;
  }

  available() {
    return Boolean(this.currentWallet());
  }

  async ready() {
    if (!this.currentWallet()) return false;

    const permissions = await this.request({ type: "wallet_getPermissions" });
    return Array.isArray(permissions) && permissions.includes("accounts");
  }

  async connect(args: { chainIdHint?: bigint } = {}): Promise<ConnectorResult> {
    if (!this.currentWallet()) throw new ConnectorNotFoundError();

    this.wallet?.on("accountsChanged", this.onAccountsChanged);
    this.wallet?.on("networkChanged", this.onNetworkChanged);

    const accounts = await this.request({ type: "wallet_requestAccounts" });
    if (!accounts) throw new UserRejectedRequestError();

    if (args.chainIdHint) {
      const chainId = await this.requestChainId();
      if (chainId !== args.chainIdHint) {
        await this.switchChain(args.chainIdHint);
      }
    }

    const [account] = accounts;
    const chainId = await this.requestChainId();
    this.emit("connect", { account, chainId });

    return { account, chainId };
  }

  async disconnect() {
    if (!this.currentWallet()) throw new ConnectorNotFoundError();

    this.wallet?.off?.("accountsChanged", this.onAccountsChanged);
    this.wallet?.off?.("networkChanged", this.onNetworkChanged);
    this.emit("disconnect");
  }

  async account(
    provider: ProviderInterface,
    paymasterProvider?: PaymasterInterface,
  ): Promise<AccountInterface> {
    if (!this.currentWallet() || (await this.isLocked())) {
      throw new ConnectorNotConnectedError();
    }

    return WalletAccount.connect(
      provider,
      this.wallet as any,
      undefined,
      paymasterProvider,
      true,
    );
  }

  async chainId() {
    if (!this.currentWallet() || (await this.isLocked())) {
      throw new ConnectorNotConnectedError();
    }

    return this.requestChainId();
  }

  async request(call: { type: string; params?: unknown }) {
    const wallet = this.currentWallet();
    if (!wallet) throw new ConnectorNotConnectedError();
    return wallet.request(call);
  }

  private currentWallet() {
    this.wallet = resolveInjectedWallet(this.walletId);
    return this.wallet;
  }

  private async isLocked() {
    const accounts = await this.request({
      type: "wallet_requestAccounts",
      params: { silent_mode: true },
    });

    return Array.isArray(accounts) && accounts.length === 0;
  }

  private async requestChainId() {
    const chainIdHex = await this.request({ type: "wallet_requestChainId" });
    return BigInt(chainIdHex);
  }

  private async switchChain(chainId: bigint) {
    await this.request({
      type: "wallet_switchStarknetChain",
      params: { chainId: num.toHex(chainId) },
    });
  }

  private onAccountsChanged = async (accounts?: string[]) => {
    const [account] = accounts || [];

    if (!account) {
      this.emit("disconnect");
      return;
    }

    this.emit("change", {
      account,
      chainId: await this.requestChainId(),
    });
  };

  private onNetworkChanged = (chainIdHex?: string, accounts?: string[]) => {
    const [account] = accounts || [];

    this.emit(
      "change",
      chainIdHex ? { chainId: BigInt(chainIdHex), account } : {},
    );
  };
}

export function idResolvedReady() {
  return new IdResolvedInjectedConnector(
    "argentX",
    "Ready Wallet (formerly Argent)",
  );
}

export function idResolvedBraavos() {
  return new IdResolvedInjectedConnector("braavos", "Braavos");
}
