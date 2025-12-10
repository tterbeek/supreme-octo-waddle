import { Link } from "react-router-dom";
import HamburgerButton from "./HamburgerButton";
import { Settings as SettingsIcon } from "lucide-react";

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
            Movement Insights
          </Link>

          <Link to="/presets" onClick={onClose} className="hover:underline">
            Manage Presets
          </Link>

          <Link
            to="/settings"
            onClick={onClose}
            className="hover:underline flex items-center gap-2"
          >
            <SettingsIcon className="w-4 h-4 text-gray-600" />
            <span>Settings</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
