import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ModalSheetProps = {
  children: ReactNode;
  onClose: () => void;
  /** Enable pull-down-to-close gesture on mobile */
  enableDragToClose?: boolean;
};

/**
 * Shared bottom-sheet modal.
 * - Full width on mobile, max-w-md centered on larger screens
 * - Dimmed backdrop
 * - Slide-up / slide-down animation
 * - Optional drag-to-close
 */
export default function ModalSheet({
  children,
  onClose,
  enableDragToClose = true,
}: ModalSheetProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    // play entrance animation
    setAnimateIn(true);
  }, []);

  const handleRequestClose = () => {
    setAnimateIn(false);
    setDragY(0);
    // match transition duration
    setTimeout(onClose, 200);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableDragToClose) return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableDragToClose) return;
    if (startY.current == null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      // Prevent pull-to-refresh / scroll
      e.preventDefault();
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!enableDragToClose) {
      startY.current = null;
      setDragY(0);
      return;
    }

    const threshold = 80;
    if (dragY > threshold) {
      handleRequestClose();
    } else {
      setDragY(0);
    }
    startY.current = null;
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 overscroll-none"
      onClick={handleRequestClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${dragY}px)`,
          touchAction: enableDragToClose ? "none" : "auto",
        }}
        className={`w-full max-w-md bg-warm-100 rounded-t-2xl p-6 shadow-lg will-change-transform
        transition-transform duration-200
        ${animateIn ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* drag handle */}
        <div className="w-10 h-1.5 bg-warm-200 rounded-full mx-auto mb-4" />
        {children}
      </div>
    </div>
  );
}
