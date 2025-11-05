import { useRef, useState } from "react";

export default function SwipeDelete({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const startX = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);

  const THRESHOLD = -40; // how far to swipe before opening fully
  const OPEN = -80; // fully open position

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const diff = e.touches[0].clientX - startX.current;
    if (diff < 0) setOffset(Math.max(diff, OPEN));
  };

  const handleTouchEnd = () => {
    setOffset(offset < THRESHOLD ? OPEN : 0);
    startX.current = null;
  };

  // ✅ Right click support (desktop)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // prevent browser context menu
    setOffset((prev) => (prev === 0 ? OPEN : 0)); // toggle delete
  };

  return (
    <div className="relative overflow-hidden select-none">
      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 text-white font-medium flex items-center justify-center"
      >
        Delete
      </button>

      {/* Content that moves */}
        <div
        className="bg-white transition-transform"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        onClick={() => {
            // ✅ If delete is open, close instead of triggering click in item
            if (offset !== 0) {
            setOffset(0);
            return;
            }
        }}
        >
        {children}
        </div>

    </div>
  );
}
