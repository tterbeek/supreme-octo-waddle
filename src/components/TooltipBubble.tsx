import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";

type TooltipBubbleProps = {
  children: ReactNode;
  onClose: () => void;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  wrapperClassName?: string;
};

export default function TooltipBubble({
  children,
  onClose,
  position = "top",
  className,
  wrapperClassName,
}: TooltipBubbleProps) {
  const positionClasses =
    position === "top"
      ? "left-1/2 -translate-x-1/2 bottom-full mb-2"
      : position === "bottom"
      ? "left-1/2 -translate-x-1/2 top-full mt-2"
      : position === "left"
      ? "right-full mr-2 top-1/2 -translate-y-1/2"
      : "left-full ml-2 top-1/2 -translate-y-1/2";

  const bubbleClassName = className ?? "max-w-xs";

  return (
    <div
      className={`absolute ${positionClasses} z-50 pointer-events-auto ${wrapperClassName ?? ""}`}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div
        className={`relative bg-white text-gray-900 text-sm p-3 rounded-xl shadow-lg border border-warm-200 animate-fadeIn ${bubbleClassName}`}
      >
        {children}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 bg-white text-black p-1 rounded-full shadow active:scale-95"
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}
