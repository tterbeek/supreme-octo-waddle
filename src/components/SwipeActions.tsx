import { useRef } from "react";
import type { ReactNode } from "react";

type SwipeActionsProps = {
  children: ReactNode;
  onDelete: () => void; // left swipe
  onEdit: () => void;   // right swipe / right-click
};

export default function SwipeActions({ children, onDelete, onEdit }: SwipeActionsProps) {
  const startX = useRef<number | null>(null);
  const lastX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    lastX.current = startX.current;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    lastX.current = e.touches[0].clientX;
    // prevent horizontal scroll when intentional swipe
    const diff = lastX.current - startX.current;
    if (Math.abs(diff) > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (startX.current == null || lastX.current == null) {
      startX.current = null;
      lastX.current = null;
      return;
    }

    const diff = lastX.current - startX.current;
    const threshold = 50; // px

    if (diff <= -threshold) {
      onDelete();        // swipe left → delete
    } else if (diff >= threshold) {
      onEdit();          // swipe right → edit
    }

    startX.current = null;
    lastX.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onEdit(); // right-click → edit
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
      style={{ touchAction: "pan-y" }} // vertical scroll allowed, horizontal handled by us
    >
      {children}
    </div>
  );
}
