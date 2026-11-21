"use client";

import { Wallet } from "lucide-react";
import { useNavCommandMenu, ActionButton } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";

export function NavConnectButton() {
  const { isConnected } = useWallet();
  const { close } = useNavCommandMenu();
  const { open: openConnectDialog } = useConnectDialog();

  return (
    <span className="flex shrink-0 items-center gap-2 text-2xs text-muted-foreground/50">
      {!isConnected && (
        <ActionButton
          solid
          small
          type="button"
          icon={<Wallet className="h-3 w-3" />}
          onClick={() => {
            close();
            openConnectDialog();
          }}
        >
          Account
        </ActionButton>
      )}
      <kbd className="hidden min-w-[18px] items-center justify-center rounded-md bg-muted/60 px-1.5 py-0.5 font-sans text-2xs leading-none text-muted-foreground sm:inline-flex">
        ⌘K
      </kbd>
    </span>
  );
}
