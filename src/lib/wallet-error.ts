export interface FriendlyWalletError {
  title: string;
  message: string;
  description?: string;
  isUserRejection: boolean;
}

/**
 * Thrown by `assertCorrectNetwork` — a dedicated sentinel so
 * `getFriendlyWalletError` maps it to an explicit, actionable message
 * instead of whatever the wallet/RPC produces once it tries (and fails) to
 * build a transaction against a network it isn't actually on.
 */
export class WrongNetworkError extends Error {
  constructor() {
    super("Your wallet is connected to the wrong network.");
    this.name = "WrongNetworkError";
  }
}

/**
 * Every write path (marketplace, launchpad, paymaster) reads `chainId` from
 * starknet-react's `useAccount()`, which reflects whatever network the
 * wallet EXTENSION itself is currently set to — independent of what the
 * dapp displays. Nothing before this guard existed ever verified the two
 * match; `isWrongNetwork` was computed and shown as a banner in two
 * components but never actually blocked a submit. A wallet sitting on a
 * different network (e.g. Sepolia while this dapp is mainnet-only) would
 * still reach the wallet's own tx builder, which resolves nonce/state
 * against ITS network — surfacing as a confusing, unrelated-looking error
 * (e.g. a nonce mismatch) with no indication the actual problem is the
 * network. Call this at the top of every `execute()`, before the wallet
 * ever sees the calls.
 */
/** The one comparison both the enforcement guard and any "wrong network"
 *  banner should use — never re-derive this inline. */
export function isWrongNetwork(
  chainId: bigint | string | undefined,
  expectedChainId: string,
): boolean {
  return chainId != null && BigInt(chainId).toString() !== expectedChainId;
}

export function assertCorrectNetwork(
  chainId: bigint | string | undefined,
  expectedChainId: string,
): void {
  if (isWrongNetwork(chainId, expectedChainId)) {
    throw new WrongNetworkError();
  }
}

function collectErrorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const source = error as Record<string, unknown>;
    const parts: string[] = [];

    for (const key of ["message", "name", "code", "shortMessage"]) {
      const value = source[key];
      if (value !== undefined) parts.push(String(value));
    }

    const messages = source.errorMessages;
    if (messages && typeof messages === "object") {
      parts.push(...Object.values(messages).map(String));
    }

    return parts.join(" ");
  }

  return String(error);
}

export function isUserRejectedRequest(error: unknown): boolean {
  const text = collectErrorText(error).toLowerCase();
  return (
    text.includes("user_refused_op") ||
    text.includes("user refused") ||
    text.includes("user rejected") ||
    text.includes("user abort") || // matches "User abort" / "User aborted" (Argent/Ready)
    text.includes("user denied") ||
    text.includes("request rejected") ||
    text.includes("rejected by user") ||
    text.includes("cancelled") ||
    text.includes("canceled") ||
    // Braavos surfaces a bare "Execute failed" when the user declines the
    // confirmation popup — there's no cleaner rejection code. Genuine on-chain
    // reverts never reach here as a bare "execute failed": they carry a revert
    // reason and are thrown from waitForTransaction, not account.execute.
    text.trim() === "execute failed"
  );
}

/** Transient network / RPC-provider failure — worth a retry, not the user's
 *  fault (e.g. Alchemy's intermittent 503 / -32001 "Unable to complete
 *  request", rate limits, gateway timeouts, fetch failures). */
function isTransientNetworkError(text: string): boolean {
  return /-32001|unable to complete request|service unavailable|temporarily unavailable|rate.?limit|too many requests|gateway time-?out|bad gateway|failed to fetch|fetch failed|network ?error|load failed|\b50[234]\b|\b429\b/i.test(
    text,
  );
}

/** Heuristic: a raw RPC / serialization blob that must never be shown to a
 *  user (the full detail is logged to the console by the caller). A message
 *  containing a raw URL (e.g. "Chain https://rpc.starknet.lava.build/ not
 *  supported" — leaked to a public Telegram community, 2026-07-02) is always
 *  technical, regardless of length: users should never see infra endpoints. */
function looksTechnical(text: string): boolean {
  return (
    /rpc:|jsonrpc|starknet_call|entry_point_selector|contract_address|fetchendpoint|errorhandler|at async|baseerror|"code"\s*:\s*-?\d|https?:\/\//i.test(
      text,
    ) || text.length > 160
  );
}

export function getFriendlyWalletError(error: unknown): FriendlyWalletError {
  if (isUserRejectedRequest(error)) {
    // The wallet-API "USER_REFUSED_OP" code (and equivalents across wallets)
    // covers more than an explicit user click-cancel — some wallets (e.g.
    // Ready's guardian/2FA-protected accounts) return the exact same code
    // when *the wallet itself* declines to sign, with no user action at all.
    // We can't tell these apart from the error alone, so the copy must not
    // assert a specific cause we don't actually know (fixed 2026-07-06 after
    // a Ready guardian-protected account was told it had "closed or rejected"
    // a request it never even prompted for).
    return {
      title: "Request not completed",
      message: "Request not completed. Nothing was submitted.",
      description: "Your wallet didn't complete this request — you may have closed or declined it, or your wallet may require extra verification (like 2FA) before it can sign. Check your wallet for details, then try again.",
      isUserRejection: true,
    };
  }

  if (error instanceof WrongNetworkError) {
    return {
      title: "Wrong network",
      message: "Your wallet is connected to the wrong network. Nothing was submitted.",
      description: "Switch your wallet to Starknet Mainnet, then try again.",
      isUserRejection: false,
    };
  }

  const raw = collectErrorText(error);

  // Transient network / RPC-provider hiccup (e.g. the intermittent Alchemy
  // 503 / -32001 "Unable to complete request"). Not the user's fault, nothing
  // was submitted, and a retry almost always succeeds.
  if (isTransientNetworkError(raw)) {
    return {
      title: "Network busy",
      message:
        "The network is busy right now — nothing was submitted and your asset is safe. Please try again in a moment.",
      isUserRejection: false,
    };
  }

  // Cartridge Controller's own account WASM throws this bare, generic message
  // when its __validate__ simulation can't cover the tx's estimated max fee —
  // it carries none of the "insufficient"/"balance"/"funds" wording the
  // generic check below looks for, so it needs its own match. Cartridge's own
  // modal already surfaces an "Add funds" CTA for this case; this mirrors
  // that here so the same message shows wherever the raw error surfaces.
  //
  // `JsControllerError` is only in `.stack`, never in `.message` — a real
  // thrown `Error` here has `message: "Validation failure"` and
  // `name: "Error"`, and `collectErrorText` returns just `error.message` for
  // `Error` instances (never `.stack`, which is usually multi-line/noisy).
  // The original check required both substrings in the same `raw` text and
  // so never actually matched a live throw (caught testing this against a
  // real Cartridge session) — check `.stack` separately instead.
  const lower = raw.toLowerCase();
  const stack = error instanceof Error && typeof error.stack === "string" ? error.stack.toLowerCase() : "";
  if (lower.includes("validation failure") && (lower.includes("jscontrollererror") || stack.includes("jscontrollererror"))) {
    return {
      title: "Not enough gas",
      message: "Your wallet doesn't have enough STRK (or ETH) to pay for this transaction's gas fee.",
      description: "Add funds to your wallet, then try again.",
      isUserRejection: false,
    };
  }

  // Not enough balance / allowance to settle the transaction.
  if (lower.includes("insufficient") && (lower.includes("balance") || lower.includes("allowance") || lower.includes("funds"))) {
    return {
      title: "Insufficient balance",
      message: "You don't have enough balance to complete this transaction.",
      isUserRejection: false,
    };
  }

  // Wallet-API spec's own generic placeholder (code 163, e.g. thrown by Ready
  // mobile's in-app browser wallet when its internal execute call fails for
  // an unspecified reason). It's short and contains none of the
  // `looksTechnical` signals, so without this it fell through to the raw
  // passthrough below and showed the literal "An error occurred
  // (UNKNOWN_ERROR)" string verbatim — meaningless and alarming to a user.
  if (/unknown_error/i.test(raw) || (typeof error === "object" && error !== null && (error as { code?: unknown }).code === 163)) {
    return {
      title: "Something went wrong",
      message:
        "Your wallet couldn't complete this transaction. Nothing was submitted — please try again, or try a different wallet or device if it keeps happening.",
      isUserRejection: false,
    };
  }

  // Anything that looks like a raw RPC / serialization blob must never reach
  // the user — the full technical detail is already logged to the console by
  // the caller. Short, human-readable messages (e.g. app-thrown validation or
  // on-chain revert reasons) are safe to show verbatim. "Something went
  // wrong" alone was flagged as unhelpful — always pair it with a concrete
  // next step so the user isn't stuck.
  if (!raw || looksTechnical(raw)) {
    return {
      title: "Something went wrong",
      message:
        "We couldn't complete that action. Please try again in a moment — if it keeps happening, try a different wallet or refresh the page.",
      isUserRejection: false,
    };
  }

  return {
    title: "Something went wrong",
    message: raw,
    isUserRejection: false,
  };
}
