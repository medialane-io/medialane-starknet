"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@medialane/ui/button";
import { useAccountSession } from "@/components/wallet-session-sync";

export function VerifyWithWalletButton({ disabled = false, className }: { disabled?: boolean; className?: string }) {
  const { signedIn, isSigningIn } = useAccountSession();
  return (
    <Button
      size="sm"
      variant="outline"
      className={className}
      disabled={isSigningIn || disabled}
      onClick={() => void signedIn()}
    >
      {isSigningIn ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Signing…</> : "Verify with wallet"}
    </Button>
  );
}
