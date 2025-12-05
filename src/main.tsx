import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Capture the beforeinstallprompt event as early as possible so the
// banner hook can access it later (after auth / layout render).
if (typeof window !== "undefined") {
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
