import type { ReactNode } from "react";
import { useEffect } from "react";
import { IconCopy } from "@tabler/icons-react";

export default function Toast(
  {
    message,
    onClose,
    durationMs = 1200,
  }: {
    message: ReactNode;
    onClose: () => void;
    durationMs?: number;
  }
) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-300 border border-amber-400 text-primary-text px-4 py-2 rounded-full shadow-lg text-sm font-medium z-50 animate-fadeIn animate-slideUp flex items-center gap-2">
      <IconCopy size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}
