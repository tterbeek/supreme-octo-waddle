import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";

const UPDATE_CHECK_THROTTLE_MS = 60_000;
const RELOAD_THROTTLE_MS = 15_000;
const LAST_RELOAD_KEY = "movenotes_last_sw_reload_at";

const initPwaUpdateRuntime = () => {
  if (typeof window === "undefined") return;

  let lastUpdateCheckAt = 0;
  let updateInFlight: Promise<void> | null = null;

  const canReloadNow = () => {
    try {
      const lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_KEY) ?? "0");
      return !Number.isFinite(lastReloadAt) || Date.now() - lastReloadAt > RELOAD_THROTTLE_MS;
    } catch {
      return true;
    }
  };

  const reloadApp = () => {
    if (!canReloadNow()) return;
    try {
      sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
    } catch {
      // Ignore storage failures in private browsing modes.
    }
    window.location.reload();
  };

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = () => {
        if (document.visibilityState === "hidden") return;
        if (updateInFlight) return;
        if (Date.now() - lastUpdateCheckAt < UPDATE_CHECK_THROTTLE_MS) return;

        lastUpdateCheckAt = Date.now();
        updateInFlight = registration
          .update()
          .then(() => undefined)
          .catch((error) => {
            console.warn("[PWA] Update check failed:", error);
          })
          .finally(() => {
            updateInFlight = null;
          });
      };

      window.setTimeout(checkForUpdate, 3_000);
      window.setInterval(checkForUpdate, 5 * 60_000);
      window.addEventListener("focus", checkForUpdate);
      window.addEventListener("pageshow", checkForUpdate);
      window.addEventListener("online", checkForUpdate);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          checkForUpdate();
        }
      });
    },
  });

  navigator.serviceWorker?.addEventListener("controllerchange", reloadApp);
};

// Capture the beforeinstallprompt event as early as possible so the
// banner hook can access it later (after auth / layout render).
if (typeof window !== "undefined") {
  initPwaUpdateRuntime();
  window.addEventListener("beforeinstallprompt", (e) => {
    // Defer the native prompt and hand off to the in-app banner.
    (e as any).preventDefault();
    (window as any).__mn_bip_event = e;
    window.dispatchEvent(new Event("mn-bip-ready"));
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
