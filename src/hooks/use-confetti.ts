"use client";

import { useEffect } from "react";
import { fireConfetti } from "@/lib/confetti";

export function useConfetti(when: boolean) {
  useEffect(() => {
    if (when) fireConfetti();
  }, [when]);
}
