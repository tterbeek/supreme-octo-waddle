type SearchBarProps = {
  searchOpen: boolean;
  searchTerm: string;
  setSearchOpen: (open: boolean) => void;
  setSearchTerm: (term: string) => void;
  onToggle: () => void;
  className?: string;
  alignCenterOnOpen?: boolean;
};

import { IconSearch } from "@tabler/icons-react";

export default function SearchBar({
  searchOpen,
  searchTerm,
  setSearchOpen,
  setSearchTerm,
  onToggle,
  className = "",
  alignCenterOnOpen = false,
}: SearchBarProps) {
  const positionClass = alignCenterOnOpen && searchOpen
    ? "fixed top-3 left-1/2 -translate-x-1/2 w-[min(60vw,420px)]"
    : "fixed top-3 right-4";

  return (
    <div className={`${positionClass} flex items-center justify-end gap-2 ${className}`}>
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
}
