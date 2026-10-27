"use client";

import { useEffect, useRef } from "react";

export function useOnOpen(open: boolean, onOpen: () => void) {
  const latest = useRef(onOpen);
  useEffect(() => {
    latest.current = onOpen;
  });
  useEffect(() => {
    if (open) latest.current();
  }, [open]);
}
