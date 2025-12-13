import { useState } from "react";
import { Link } from "react-router-dom";
import {
  IconX,
  IconLayoutList,
  IconChartLine,
  IconSettings,
  IconShare,
} from "@tabler/icons-react";
import Toast from "./Toast";

export default function Sidebar({
  open,
  onClose,
  onShareToast,
}: {
  open: boolean;
  onClose: () => void;
  onShareToast?: (message: string) => void;
}) {
  const [localToast, setLocalToast] = useState<string | null>(null);
  const handleShare = async () => {
    const text =
      "I’ve been using MoveNotes — a simple, private movement journal. No GPS, no pressure, just movement and reflection.";
    const url = "https://movenotes.app";
    const payload = `${text}\n\n${url}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "MoveNotes",
          text,
          url,
        });
        onClose();
        return;
      } catch {
        // user cancelled — do nothing
      }
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(payload);
      } else {
        const ta = document.createElement("textarea");
        ta.value = payload;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (onShareToast) {
        onShareToast("Link copied — share it wherever it fits.");
      } else {
        setLocalToast("Link copied — share it wherever it fits.");
      }
      onClose();
    } catch (err) {
      console.error("Unable to copy share link", err);
      if (onShareToast) {
        onShareToast("Could not copy link. Please copy it manually.");
      } else {
        setLocalToast("Could not copy link. Please copy it manually.");
      }
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-50 transition ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
        />

        <div
          className={`absolute top-0 left-0 h-full w-72 bg-movenotes-surface shadow-xl p-6 transition-transform ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-warm-100 transition"
              aria-label="Close sidebar"
            >
              <IconX size={18} strokeWidth={1.7} />
            </button>
            <div className="text-lg font-semibold text-movenotes-text">
              Menu
            </div>
          </div>

          <div className="space-y-2">
            <Link
              to="/"
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-movenotes-text hover:bg-warm-100 transition"
            >
              <IconLayoutList size={18} strokeWidth={1.7} />
              <span className="text-sm font-medium">Activity Feed</span>
            </Link>
            <Link
              to="/stats"
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-movenotes-text hover:bg-warm-100 transition"
            >
              <IconChartLine size={18} strokeWidth={1.7} />
              <span className="text-sm font-medium">Movement Insights</span>
            </Link>
          </div>

          <div className="mt-6 pt-4 border-t border-warm-200 space-y-2">
            <Link
              to="/settings"
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-movenotes-text hover:bg-warm-100 transition"
            >
              <IconSettings size={18} strokeWidth={1.7} />
              <span className="text-sm font-medium">Settings</span>
            </Link>
            <button
              onClick={handleShare}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-movenotes-muted hover:bg-warm-100 transition"
            >
              <IconShare size={18} strokeWidth={1.7} />
              <span className="text-sm">Share MoveNotes</span>
            </button>
          </div>
        </div>
      </div>
      {localToast && (
        <Toast message={localToast} onClose={() => setLocalToast(null)} />
      )}
    </>
  );
}
