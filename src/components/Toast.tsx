import type { ReactNode } from "react";
import { useEffect } from "react";

export default function Toast(
  { message, onClose }: { message: ReactNode; onClose: () => void }
) {
  useEffect(() => {
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
<div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-300 border border-amber-400 text-black px-4 py-2 rounded-full shadow-lg text-sm font-medium z-50 animate-fadeIn animate-slideUp">
  {message}
</div>
  );
}
