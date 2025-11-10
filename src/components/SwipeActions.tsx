// src/components/SwipeActions.tsx
import { useRef, useState } from "react";

type SwipeActionsProps = {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit: () => void;
};

export default function SwipeActions({ children, onDelete, onEdit }: SwipeActionsProps) {
  const startX = useRef<number | null>(null);
  const [deltaX, setDeltaX] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const diff = e.touches[0].clientX - startX.current;
    setDeltaX(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) onDelete();
      else onEdit();
    }
    setDeltaX(0);
    startX.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onEdit();
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative transition-transform duration-150"
      style={{
        transform: `translateX(${deltaX}px)`,
        touchAction: "pan-y",
      }}
    >
      {children}
    </div>
  );
}
