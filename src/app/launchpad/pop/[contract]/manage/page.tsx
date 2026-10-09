"use client";

import { use, useState } from "react";
import Link from "next/link";
import { normalizeAddress } from "@medialane/sdk";
import {
  ArrowLeft, Users, Award, Loader2, CheckCircle2, AlertCircle, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FadeIn } from "@/components/ui/motion-primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/use-wallet";
import { useCollection } from "@/hooks/use-collections";
import { isCollectionOwner } from "@/lib/utils";
import { buildPopAllowlist } from "@medialane/sdk/starknet";
import { claimLinks, claimLinksCsv, type ClaimLink } from "@/lib/pop-claim";

function parseAddresses(raw: string): string[] {
  return raw
    .split(/[\n,\s]+/)
    .map((a) => a.trim())
    .filter((a) => /^0x[0-9a-fA-F]+$/.test(a));
}

function downloadCsv(links: ClaimLink[]) {
  const href = URL.createObjectURL(new Blob([claimLinksCsv(links)], { type: "text/csv" }));
  const anchor = Object.assign(document.createElement("a"), { href, download: "claim-links.csv" });
  anchor.click();
  URL.revokeObjectURL(href);
}

function AllowlistSection({
  onPublish,
  isSubmitting,
  links,
}: {
  onPublish: (addresses: string[]) => void;
  isSubmitting: boolean;
  links: ClaimLink[] | null;
}) {
  const [raw, setRaw] = useState("");
  const parsed = parseAddresses(raw);

  return (
    <div className="bento-cell p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-green-500" />
        <span className="font-semibold text-sm">Participants</span>
        {parsed.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {parsed.length} address{parsed.length !== 1 ? "es" : ""}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Paste every participant&apos;s wallet address. Publishing replaces the previous list and every link
        sent before it — send the new links to everyone who hasn&apos;t claimed yet. The list stays in this
        browser: download the claim links and send each participant theirs.
      </p>
      <Textarea
        placeholder={"Paste Starknet addresses, one per line:\n0x04a...\n0x06b..."}
        rows={8}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="tabular-nums text-xs resize-none"
      />
      <Button
        size="sm"
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        disabled={parsed.length === 0 || isSubmitting}
        onClick={() => onPublish(parsed)}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            Publishing…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Publish {parsed.length > 0 ? `${parsed.length} participant${parsed.length !== 1 ? "s" : ""}` : "participants"}
          </>
        )}
      </Button>
      {links && (
        <div className="space-y-2 pt-2">
          <Button variant="outline" size="sm" className="w-full" onClick={() => downloadCsv(links)}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download claim links (CSV)
          </Button>
          <ul className="max-h-48 overflow-auto text-xs tabular-nums space-y-1 text-muted-foreground">
            {links.map((link) => (
              <li key={link.address} className="truncate">{link.address}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PopManagePage({
  params,
}: {
  params: Promise<{ contract: string }>;
}) {
  const { contract } = use(params);
  const { address, isConnected, execute } = useWallet();
  const { collection, isLoading } = useCollection(contract);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [txMessage, setTxMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [links, setLinks] = useState<ClaimLink[] | null>(null);

  const isOwner = isCollectionOwner(collection, address);

  const runTx = async (
    calls: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }>,
    successMsg: string
  ): Promise<boolean> => {
    setIsTxLoading(true);
    setTxMessage(null);
    try {
      await execute(calls);
      setTxMessage({ tone: "success", text: successMsg });
      return true;
    } catch (err) {
      console.error("manage action failed", err);
      setTxMessage({ tone: "error", text: "That change could not be completed. Please try again." });
      return false;
    } finally {
      setIsTxLoading(false);
    }
  };

  const handlePublish = (addresses: string[]) => {
    const list = buildPopAllowlist(addresses);
    const count = Object.keys(list.proofs).length;
    void runTx(
      [{ contractAddress: contract, entrypoint: "set_allowlist_root", calldata: [list.root] }],
      `Published ${count} participant${count !== 1 ? "s" : ""}`
    ).then((ok) => {
      if (ok) setLinks(claimLinks(window.location.origin, contract, list));
    });
  };

  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        <Award className="h-10 w-10 text-muted-foreground/20 mx-auto" />
        <h1 className="text-xl font-bold">Connect your wallet</h1>
        <div className="flex justify-center">
          <ConnectWallet />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-10 pb-16 space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground/20 mx-auto" />
        <p className="text-muted-foreground">Collection not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/launchpad/pop">← Back</Link>
        </Button>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        <Award className="h-10 w-10 text-muted-foreground/20 mx-auto" />
        <p className="text-muted-foreground">You are not the organizer of this event.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/launchpad/pop">← Back to events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-10 pb-16 space-y-6">
      {txMessage && (
        <p
          role={txMessage.tone === "error" ? "alert" : "status"}
          className={txMessage.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-500"}
        >
          {txMessage.text}
        </p>
      )}
      <FadeIn>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/launchpad/pop">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            All events
          </Link>
        </Button>
      </FadeIn>

      <FadeIn delay={0.04}>
        <div>
          <span className="pill-badge inline-flex gap-1.5 mb-2">
            <Award className="h-3 w-3" />
            Organizer
          </span>
          <h1 className="text-2xl font-bold mt-1">Manage Event</h1>
          <p className="text-sm text-muted-foreground">{collection.name ?? contract}</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.08}>
        <div className="bento-cell p-4 flex items-center gap-3">
          <Award className="h-4 w-4 text-green-500 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Only participants on your <strong className="text-foreground">published list</strong> can claim,
            with the link you send them.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.12}>
        <AllowlistSection onPublish={handlePublish} isSubmitting={isTxLoading} links={links} />
      </FadeIn>
    </div>
  );
}
