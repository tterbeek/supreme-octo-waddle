import { useId, useLayoutEffect, useRef, useState } from "react";
import { allowFormNavigation, dismissDecision, formLeaves } from "../lib/formLifecycle";

export function useFormLeave(dirty: boolean, busy: boolean, onClose: () => void, priority = -1) {
  const id = useId();
  const [confirm, setConfirm] = useState(false);
  const pending = useRef<{ proceed: () => void; cancel: () => void } | null>(null);
  const request = (proceed = onClose, cancel = () => {}) => {
    const decision = dismissDecision(dirty, busy);
    if (decision === "wait") { cancel(); return; }
    if (decision === "close") { allowFormNavigation(proceed); return; }
    pending.current = { proceed, cancel }; setConfirm(true);
  };
  useLayoutEffect(() => {
    formLeaves.set({ id, priority, dirty, busy, request });
    return () => formLeaves.remove(id);
  });
  const keep = () => { pending.current?.cancel(); pending.current = null; setConfirm(false); };
  const discard = () => { const action = pending.current?.proceed ?? onClose; pending.current = null; setConfirm(false); allowFormNavigation(action); };
  return { confirm, request, keep, discard };
}
