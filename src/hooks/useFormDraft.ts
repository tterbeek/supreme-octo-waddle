import { useEffect, useRef, useState } from "react";
import { draftSnapshot } from "../lib/formLifecycle";

export function useFormDraft(value: unknown, ready = true) {
  const snapshot = draftSnapshot(value);
  const baseline = useRef<string | null>(ready ? snapshot : null);
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!ready) baseline.current = null;
    else if (baseline.current === null) { baseline.current = snapshot; rerender(n => n + 1); }
  }, [ready, snapshot]);
  return { dirty: ready && baseline.current !== null && snapshot !== baseline.current,
    markSaved: () => { baseline.current = snapshot; rerender(n => n + 1); } };
}
