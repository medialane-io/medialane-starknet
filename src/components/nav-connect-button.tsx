"use client";

import { Wallet } from "lucide-react";
import { useNavCommandMenu } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";

export function NavConnectButton() {
  const { isConnected } = useWallet();
  const { close } = useNavCommandMenu();
  const { open: openConnectDialog } = useConnectDialog();

  return (
    <span className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground/50">
      {!isConnected && (
        <div className="btn-border-animated rounded-lg p-[1px]">
          <button
            type="button"
            onClick={() => {
              close();
              openConnectDialog();
            }}
            className="flex items-center gap-1.5 rounded-[7px] bg-transparent px-2.5 py-1 text-[11px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Wallet className="h-3 w-3" />
            Connect
          </button>
        </div>
      )}
      <kbd className="hidden min-w-[18px] items-center justify-center rounded-md bg-muted/60 px-1.5 py-0.5 font-sans text-[10px] leading-none text-muted-foreground sm:inline-flex">
        ⌘K
      </kbd>
    </span>
  );
}
