import { useEffect, useState, useCallback } from "react";

// Type for the 'beforeinstallprompt' event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "mn_pwa_install_dismissed";
const INSTALLED_KEY = "mn_pwa_installed";

export function usePwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const setFromPromptEvent = useCallback(
    (
      bipEvent: BeforeInstallPromptEvent,
      opts: { alreadyDismissed: boolean; alreadyInstalled: boolean }
    ) => {
      setDeferredPrompt(bipEvent);
      if (!opts.alreadyDismissed && !opts.alreadyInstalled) {
        setShowBanner(true);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadyDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    const alreadyInstalled = localStorage.getItem(INSTALLED_KEY) === "1";

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      // iOS Safari
      (window.navigator as any).standalone === true;

    if (alreadyInstalled || isStandalone) {
      localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }

    // If an early listener captured the event, use it immediately.
    const cached = (window as any).__mn_bip_event as
      | BeforeInstallPromptEvent
      | undefined;
    if (cached) {
      setFromPromptEvent(cached, { alreadyDismissed, alreadyInstalled });
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      const bipEvent = e as BeforeInstallPromptEvent;
      setFromPromptEvent(bipEvent, { alreadyDismissed, alreadyInstalled });
      (window as any).__mn_bip_event = bipEvent;
    }

    function handleAppInstalled() {
      localStorage.setItem(INSTALLED_KEY, "1");
      setShowBanner(false);
      setDeferredPrompt(null);
    }

    function handleCachedReady() {
      const ev = (window as any).__mn_bip_event as
        | BeforeInstallPromptEvent
        | undefined;
      if (ev) {
        setFromPromptEvent(ev, { alreadyDismissed, alreadyInstalled });
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("mn-bip-ready", handleCachedReady);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("mn-bip-ready", handleCachedReady);
    };
  }, [setFromPromptEvent]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "1");
        setShowBanner(false);
        setDeferredPrompt(null);
      } else {
        localStorage.setItem(DISMISS_KEY, "1");
        setShowBanner(false);
      }
    } catch (err) {
      console.error("[PWA Install] prompt error", err);
      setShowBanner(false);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }, []);

  return {
    showBanner,
    handleInstallClick,
    handleDismiss,
  };
}
