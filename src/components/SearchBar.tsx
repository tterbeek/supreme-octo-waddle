type SearchBarProps = {
  searchOpen: boolean;
  searchTerm: string;
  setSearchOpen: (open: boolean) => void;
  setSearchTerm: (term: string) => void;
  onToggle: () => void;
  className?: string;
  alignCenterOnOpen?: boolean;
  portalTargetId?: string;
  centerPortalTargetId?: string;
};

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconSearch } from "@tabler/icons-react";

export default function SearchBar({
  searchOpen,
  searchTerm,
  setSearchOpen,
  setSearchTerm,
  onToggle,
  className = "",
  alignCenterOnOpen = false,
  portalTargetId,
  centerPortalTargetId,
}: SearchBarProps) {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const targetId =
      alignCenterOnOpen && searchOpen && centerPortalTargetId
        ? centerPortalTargetId
        : portalTargetId;
    if (targetId) {
      setPortalEl(document.getElementById(targetId));
    } else {
      setPortalEl(null);
    }
  }, [portalTargetId, centerPortalTargetId, alignCenterOnOpen, searchOpen]);

  const positionClass =
    alignCenterOnOpen && searchOpen
      ? "flex items-center justify-center w-[min(60vw,420px)]"
      : "flex items-center justify-end";

  const content = (
    <div className={`${positionClass} gap-2 ${className}`}>
      {searchOpen ? (
        <div className="relative w-full min-w-[220px] transition-all duration-200">
          <input
            type="text"
            className="w-full rounded-full border border-warm-200 bg-warm-100 px-4 py-2 text-sm shadow-sm pr-8 focus:outline-none focus:ring-1 focus:ring-movenotes-primary/60 focus:border-movenotes-primary/60"
            placeholder="Search…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          <button
            onClick={() => {
              setSearchTerm("");
              setSearchOpen(false);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-gray-800"
            aria-label="Close search"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="p-2 rounded-full hover:bg-warm-100 transition"
          aria-label="Open search"
        >
          <IconSearch size={20} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );

  if (portalEl) {
    return createPortal(content, portalEl);
  }

  return content;
}
