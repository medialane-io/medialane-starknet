import { useCallback, useState } from "react";

export function useDraft<T extends object>(saved: T) {
  const [edits, setEdits] = useState<Partial<T>>({});
  const edit = useCallback((patch: Partial<T>) => setEdits((current) => ({ ...current, ...patch })), []);
  return { draft: { ...saved, ...edits } as T, edit };
}
