export interface FriendlyWalletError {
  title: string;
  message: string;
  description?: string;
  isUserRejection: boolean;
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
 *  user (the full detail is logged to the console by the caller). */
function looksTechnical(text: string): boolean {
  return (
    /rpc:|jsonrpc|starknet_call|entry_point_selector|contract_address|fetchendpoint|errorhandler|at async|baseerror|"code"\s*:\s*-?\d/i.test(
      text,
    ) || text.length > 160
  );
}

export function getFriendlyWalletError(error: unknown): FriendlyWalletError {
  if (isUserRejectedRequest(error)) {
    return {
      title: "Request cancelled",
      message: "Request cancelled. Nothing was submitted.",
      description: "You closed or rejected the wallet request. Review the details and try again whenever you're ready.",
      isUserRejection: true,
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

  // Not enough balance / allowance to settle the transaction.
  const lower = raw.toLowerCase();
  if (lower.includes("insufficient") && (lower.includes("balance") || lower.includes("allowance") || lower.includes("funds"))) {
    return {
      title: "Insufficient balance",
      message: "You don't have enough balance to complete this transaction.",
      isUserRejection: false,
    };
  }

  // Anything that looks like a raw RPC / serialization blob must never reach
  // the user — the full technical detail is already logged to the console by
  // the caller. Short, human-readable messages (e.g. app-thrown validation or
  // on-chain revert reasons) are safe to show verbatim.
  if (!raw || looksTechnical(raw)) {
    return {
      title: "Transaction failed",
      message: "Something went wrong while processing this transaction. Please try again in a moment.",
      isUserRejection: false,
    };
  }

  return {
    title: "Transaction failed",
    message: raw,
    isUserRejection: false,
  };
}
