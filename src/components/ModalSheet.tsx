import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalSheetProps = {
  children: ReactNode;
  onClose: () => void;
  enableDragToClose?: boolean;
};

export default function ModalSheet({
  children,
  onClose,
  enableDragToClose = true,
}: ModalSheetProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const openedAt = useRef<number>(Date.now());
  const [allowOverlayClose, setAllowOverlayClose] = useState(false);

  useEffect(() => {
    openedAt.current = Date.now();
    setMounted(true);
    setAnimateIn(true);
    const timer = setTimeout(() => setAllowOverlayClose(true), 700);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);

  if (!mounted) return null;

  const handleRequestClose = () => {
    setAnimateIn(false);
    setTimeout(onClose, 200);
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 overscroll-none"
      onClick={() => {
        // avoid closing immediately from the tap that opened the modal
        const elapsed = Date.now() - openedAt.current;
        if (elapsed < 200 || !allowOverlayClose) return;
        handleRequestClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          if (!enableDragToClose) return;
          startY.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (!enableDragToClose) return;
          if (startY.current == null) return;
          const currentY = e.touches[0].clientY;
          const diff = currentY - startY.current;
          if (diff > 0) {
            e.preventDefault();
            setDragY(diff);
          }
        }}
        onTouchEnd={() => {
          if (!enableDragToClose) return;
          const threshold = 80;
          if (dragY > threshold) {
            handleRequestClose();
          } else {
            setDragY(0);
          }
          startY.current = null;
        }}
        style={{
          transform: `translateY(${dragY}px)`,
          touchAction: enableDragToClose ? "none" : "auto",
        }}
        className={`w-full max-w-md bg-warm-100 rounded-t-2xl p-6 shadow-lg will-change-transform
        transition-transform duration-200
        ${animateIn ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="w-10 h-1.5 bg-warm-200 rounded-full mx-auto mb-4" />
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
