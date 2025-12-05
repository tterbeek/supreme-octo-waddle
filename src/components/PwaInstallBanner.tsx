import { IconX } from "@tabler/icons-react";

type PwaInstallBannerProps = {
  onInstall: () => void;
  onDismiss: () => void;
};

export default function PwaInstallBanner({
  onInstall,
  onDismiss,
}: PwaInstallBannerProps) {
  return (
    <div className="fixed bottom-3 left-0 right-0 z-40 flex justify-center px-3">
      <div className="relative max-w-md w-full bg-movenotes-surface border border-movenotes-border rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-movenotes-text">
            Install MoveNotes on your home screen
          </p>
          <p className="text-xs text-movenotes-muted mt-1">
            Opens full-screen and feels like a native app. No extra download needed.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={onInstall}
            className="text-xs px-3 py-1.5 rounded-full bg-movenotes-primary text-primary-text font-medium active:scale-95 transition"
          >
            Install
          </button>
          <button
            onClick={onDismiss}
            className="text-[11px] text-movenotes-muted flex items-center gap-1 active:scale-95"
          >
            <IconX size={12} />
            <span>Not now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
