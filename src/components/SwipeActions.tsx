import type { ReactNode, MouseEvent, TouchEvent } from "react";

type SwipeActionsProps = {
  children: ReactNode;
  onEdit: () => void;
};

export default function SwipeActions({ children, onEdit }: SwipeActionsProps) {
  let touchStartY = 0;
  let touchEndY = 0;

  const onTouchStart = (e: TouchEvent) => {
    touchStartY = e.touches[0].clientY;
  };

  const onTouchEnd = () => {
    const diff = Math.abs(touchEndY - touchStartY);

    // If vertical movement is small → treat as a tap
    if (diff < 10) {
      onEdit();
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    touchEndY = e.touches[0].clientY;
    // ❗ Do NOT call preventDefault — allow native scrolling
  };

  const onClick = (e: MouseEvent) => {
    onEdit();
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      className="relative"
      style={{ touchAction: "pan-y" }} // allow vertical scroll
    >
      {children}
    </div>
  );
}
