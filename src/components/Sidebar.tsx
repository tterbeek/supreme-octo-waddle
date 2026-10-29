import ModalSheet from "./ModalSheet";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  IconSettings,
  IconShare,
  IconInfoCircle,
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
      "I’ve been using MoveNotes — a simple, private movement journal. Activities, photos, maps and reflection, without pressure.";
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
      {open && <ModalSheet title="Menu" presentation="drawer" onClose={onClose}>
          <div className="space-y-2">
            <Link
              to="/settings"
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-movenotes-text hover:bg-warm-100 transition"
            >
              <IconSettings size={18} strokeWidth={1.7} />
              <span className="text-sm font-medium">Settings</span>
            </Link>
            <a
              href="/about"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-movenotes-text hover:bg-warm-100 transition"
            >
              <IconInfoCircle size={18} strokeWidth={1.7} />
              <span className="text-sm font-medium">About MoveNotes</span>
            </a>
            <button
              onClick={handleShare}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-movenotes-muted hover:bg-warm-100 transition"
            >
              <IconShare size={18} strokeWidth={1.7} />
              <span className="text-sm">Share MoveNotes</span>
            </button>
          </div>
      </ModalSheet>}
      {localToast && (
        <Toast message={localToast} onClose={() => setLocalToast(null)} />
      )}
    </>
  );
}
