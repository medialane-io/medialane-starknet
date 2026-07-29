"use client";

import { LogIn } from "lucide-react";
import { useNavCommandMenu } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";

/**
 * Replaces the command menu footer's static "medialane" text (NavCommandMenu's
 * `brandSlot`) with an actionable connect entry point when disconnected — users
 * had no obvious way to connect from the menu after the wallet component was
 * removed from it. The "⌘K" shortcut hint stays regardless of connection state
 * — only the brand label itself was meant to go, never the shortcut hint.
 * Once connected, only the hint remains; the "Log out" row in the Account
 * command group covers disconnecting.
 */
export function NavConnectButton() {
  const { isConnected } = useWallet();
  const { close } = useNavCommandMenu();
  const { open: openConnectDialog } = useConnectDialog();

  return (
    <span className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground/50">
      {!isConnected && (
        <button
          type="button"
          onClick={() => {
            close();
            openConnectDialog();
          }}
          className="ml-gbtn relative flex items-center gap-1.5 rounded-lg bg-transparent px-2.5 py-1 text-[11px] font-semibold text-foreground transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{ "--ml-grad": "conic-gradient(from 0deg, #3b7bff, #8a5cf6, #f6608f, #3b7bff)" } as React.CSSProperties}
        >
          <LogIn className="h-3 w-3" />
          Connect
        </button>
      )}
      <kbd className="hidden min-w-[18px] items-center justify-center rounded-md bg-muted/60 px-1.5 py-0.5 font-sans text-[10px] leading-none text-muted-foreground sm:inline-flex">
        ⌘K
      </kbd>
    </span>
  );
}
