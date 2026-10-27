"use client";

import { useState, useCallback } from "react";
import { useMyUsernameClaim, submitUsernameClaim, checkUsernameAvailability } from "@/hooks/use-username-claims";
import type { InlineMessage } from "@/components/shared/inline-note";

export type UsernameCheckState = "idle" | "checking" | "available" | "taken";

export function useUsernameClaimForm() {
  const { mutate: mutateClaim } = useMyUsernameClaim();
  const [input, setInputValue] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [checkState, setCheckState] = useState<UsernameCheckState>("idle");
  const [checkReason, setCheckReason] = useState<string | undefined>();
  const [message, setMessage] = useState<InlineMessage>(null);

  const setInput = useCallback((value: string) => {
    setInputValue(value);
    setCheckState("idle");
    setCheckReason(undefined);
  }, []);

  const check = async () => {
    if (!input.trim()) return;
    setCheckState("checking");
    setCheckReason(undefined);
    try {
      const result = await checkUsernameAvailability(input);
      setCheckState(result.available ? "available" : "taken");
      if (!result.available) setCheckReason(result.reason);
    } catch {
      setCheckState("idle");
      setMessage({ tone: "error", text: "We could not check that username just now. Please try again." });
    }
  };

  const claim = async () => {
    if (!input.trim()) return;
    setClaiming(true);
    try {
      const result = await submitUsernameClaim(input.trim().toLowerCase(), undefined);
      if (result.error) {
        setMessage({ tone: "error", text: result.error });
      } else {
        setMessage({ tone: "success", text: "Username claim submitted. The Medialane DAO team will review it shortly." });
        setInput("");
        await mutateClaim();
      }
    } catch (err) {
      console.error("username claim failed", err);
      setMessage({ tone: "error", text: "That claim could not be submitted. Please try again." });
    } finally {
      setClaiming(false);
    }
  };

  return { input, setInput, claiming, checkState, checkReason, message, check, claim };
}

export type UsernameClaimForm = ReturnType<typeof useUsernameClaimForm>;
