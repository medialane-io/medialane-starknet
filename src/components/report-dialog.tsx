"use client";

import { MedialaneApiError } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";
import { useState } from "react";
import { Flag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSiwsToken } from "@/hooks/use-siws-token";

export type ReportTarget =
  | { type: "TOKEN"; contract: string; tokenId: string; name?: string }
  | { type: "COLLECTION"; contract: string; name?: string }
  | { type: "CREATOR"; address: string; name?: string }
  | { type: "COMMENT"; commentId: string };

const CATEGORIES = [
  { value: "COPYRIGHT_PIRACY", label: "Copyright / Piracy" },
  { value: "VIOLENCE_GRAPHIC", label: "Violence / Graphic content" },
  { value: "HATE_SPEECH", label: "Hate speech" },
  { value: "SCAM_FRAUD", label: "Scam / Fraud" },
  { value: "SPAM", label: "Spam" },
  { value: "NSFW", label: "NSFW / Adult content" },
  { value: "OTHER", label: "Other" },
] as const;

interface ReportDialogProps {
  target: ReportTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ target, open, onOpenChange }: ReportDialogProps) {
  const { getValidToken } = useSiwsToken();
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleCategory = (value: string) => {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setCategories([]);
      setDescription("");
      setSubmitted(false);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (categories.length === 0 || loading || submitted) return;
    setSubmitError(null);
    setLoading(true);

    try {
      const token = await getValidToken();
      if (!token) {
        setSubmitError("Sign in with your wallet to send a report.");
        return;
      }
      await getMedialaneClient().api.submitReport(
        {
          targetType: target.type,
          categories,
          description: description.trim() || undefined,
          ...(target.type === "TOKEN" ? { targetContract: target.contract, targetTokenId: target.tokenId } : {}),
          ...(target.type === "COLLECTION" ? { targetContract: target.contract } : {}),
          ...(target.type === "CREATOR" ? { targetAddress: target.address } : {}),
          ...(target.type === "COMMENT" ? { targetId: target.commentId } : {}),
        },
        token,
      );
      setSubmitted(true);
    } catch (err) {
      if (err instanceof MedialaneApiError && err.status === 409) {
        setSubmitError("You have already reported this content.");
        return;
      }
      if (err instanceof MedialaneApiError && err.status === 429) {
        setSubmitError("You are sending reports too quickly. Please wait a moment and try again.");
        return;
      }
      console.error("report submission failed", err);
      setSubmitError("Your report could not be sent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const targetLabel =
    target.type !== "COMMENT" && target.name
      ? `"${target.name}"`
      : target.type.charAt(0) + target.type.slice(1).toLowerCase();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4" />
            Report {targetLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              What&apos;s wrong with this content?{" "}
              <span className="text-muted-foreground font-normal">
                (select all that apply)
              </span>
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIES.map(({ value, label }) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={value}
                    checked={categories.includes(value)}
                    onCheckedChange={() => toggleCategory(value)}
                    disabled={submitted}
                  />
                  <label
                    htmlFor={value}
                    className="text-sm cursor-pointer leading-none"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description" className="text-sm font-medium">
              Additional details{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="report-description"
              placeholder="Describe the issue in more detail (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="resize-none h-24"
              disabled={submitted}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Reports are reviewed by the Medialane DAO team. Content remains
            accessible onchain and via the permissionless dapp.
          </p>
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-destructive">{submitError}</p>
        )}
        {submitted && (
          <p role="status" className="text-sm text-emerald-500">
            Report submitted. The Medialane DAO team will review it.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={categories.length === 0 || loading || submitted}
          >
            {loading ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
