import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

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
        <h2 className="text-lg font-semibold mb-6">Menu</h2>

        <nav className="flex flex-col gap-4 text-md">
          <Link to="/presets" onClick={onClose} className="hover:underline">
            Manage Presets
          </Link>

          <Link to="/goals" onClick={onClose} className="hover:underline">
            Manage Goals
          </Link>

          <button
            className="text-left text-red-600 hover:underline"
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
