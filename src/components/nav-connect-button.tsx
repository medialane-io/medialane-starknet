"use client";

import { LogIn } from "lucide-react";
import { useNavCommandMenu } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";

/**
 * Replaces the command menu's static "medialane" footer brandmark
 * (NavCommandMenu's `brandSlot`) with an actionable connect entry point —
 * users had no obvious way to connect from the menu after the wallet
 * component was removed from it. Renders nothing once connected; the
 * "Log out" row in the Account command group covers that case.
 */
export function NavConnectButton() {
  const { isConnected } = useWallet();
  const { close } = useNavCommandMenu();
  const { open: openConnectDialog } = useConnectDialog();

  if (isConnected) return null;

  return (
    <button
      type="button"
      onClick={() => {
        close();
        openConnectDialog();
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-blue via-brand-purple to-brand-rose px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
    >
      <LogIn className="h-3 w-3" />
      Connect
    </button>
  );
}
