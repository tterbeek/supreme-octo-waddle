import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import HamburgerButton from "./HamburgerButton";

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* dim background */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* sidebar panel */}
      <div
        className={`absolute top-0 left-0 h-full w-64 bg-white shadow-lg p-6 transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      {/* HAMBURGER HEADER */}
      <div className="flex items-center justify-between mb-6">
        <HamburgerButton open={open} onClick={onClose} />
      </div>

        {/* NAV LINKS */}
        <nav className="flex flex-col gap-4 text-md">

          {/* ⭐ Recommended: include Home */}
          <Link to="/" onClick={onClose} className="hover:underline">
            Activity Feed
          </Link>

          <Link to="/stats" onClick={onClose} className="hover:underline">
            Statistics
          </Link>

          <Link to="/goals" onClick={onClose} className="hover:underline">
            Manage Goals
          </Link>

          <Link to="/presets" onClick={onClose} className="hover:underline">
            Manage Presets
          </Link>


          {/* Logout */}
          <button
            className="text-left text-red-600 hover:underline mt-4"
            onClick={async () => {
              await supabase.auth.signOut();
              onClose();
              window.location.reload();
            }}
          >
            Logout
          </button>
        </nav>
      </div>
    </div>
  );
}
