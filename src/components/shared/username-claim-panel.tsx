"use client";

import Link from "next/link";
import { useWallet } from "@/hooks/use-wallet";
import { useMyUsernameClaim } from "@/hooks/use-username-claims";
import { useUsernameClaimForm } from "@/hooks/use-username-claim-form";
import { InlineNote } from "@/components/shared/inline-note";
import { UsernameInput } from "@/components/shared/username-input";
import { VerifyWithWalletButton } from "@/components/shared/verify-with-wallet-button";
import { useAccountSession } from "@/components/wallet-session-sync";
import { Button } from "@medialane/ui/button";
import { Badge } from "@medialane/ui/badge";
import { AtSign, CheckCircle, Clock, XCircle, ArrowRight } from "lucide-react";
import { profileHref } from "@/lib/routes";

export function UsernameClaimPanel({ bare = false }: { bare?: boolean } = {}) {
  const shell = bare ? "space-y-3 max-w-lg" : "bento-cell p-5 space-y-3";
  const { address: walletAddress } = useWallet();
  const { session: accountSession } = useAccountSession();
  const { username: approvedUsername, claim } = useMyUsernameClaim();

  const usernameVerified = !!accountSession;
  const usernameForm = useUsernameClaimForm();

  if (approvedUsername) {
    return (
      <div className={shell}>
        {!bare && (
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-primary" />
            <p className="font-semibold">Username</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-muted-foreground">Your username:</span>
            <a href={profileHref({ username: approvedUsername })} className="tabular-nums font-medium text-primary hover:underline">
              @{approvedUsername}
            </a>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={profileHref({ username: approvedUsername })}>
              View profile <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!usernameVerified) {
    return (
      <div className={shell}>
        {!bare && (
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-primary" />
            <p className="font-semibold">Username</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Sign a message with your wallet to check whether you already have a username.
        </p>
        <VerifyWithWalletButton disabled={!walletAddress} />
      </div>
    );
  }

  if (claim?.status === "PENDING") {
    return (
      <div className={shell}>
        {!bare && (
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-primary" />
            <p className="font-semibold">Username</p>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
          <span>
            Your claim for{" "}
            <span className="tabular-nums font-medium text-foreground">@{claim.username}</span> is pending DAO review.
          </span>
          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 ml-1">
            Pending
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      {!bare && (
        <div className="flex items-center gap-2">
          <AtSign className="h-4 w-4 text-primary" />
          <p className="font-semibold">Claim Your Username</p>
        </div>
      )}

      {claim?.status === "REJECTED" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span>
            Your claim for <span className="tabular-nums">@{claim.username}</span> was rejected.
            {claim.adminNotes && <span className="ml-1 italic">&ldquo;{claim.adminNotes}&rdquo;</span>}
          </span>
        </div>
      )}

      {!bare && (
        <p className="text-sm text-muted-foreground">
          Get a shareable profile URL like{" "}
          <span className="tabular-nums text-foreground">medialane.io/creator/yourname</span>.
          Claims are reviewed by the Medialane DAO to prevent impersonation.
        </p>
      )}

      <UsernameInput form={usernameForm} disabled={!walletAddress} />
      <InlineNote message={usernameForm.message} />
    </div>
  );
}
