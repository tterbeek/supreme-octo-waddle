import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
VitePWA({
  registerType: "autoUpdate",
  workbox: {
    clientsClaim: true,   // 🔥 take control without reload
    skipWaiting: true,    // 🔥 activate new SW immediately
  },
  manifest: {
    name: "MoveNotes",
    short_name: "MoveNotes",
    theme_color: "#5a7a69",
    background_color: "#f3ede4",
    display: "standalone",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-180x180.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-256x256.png", sizes: "256x256", type: "image/png" },
      { src: "/icon-150x150.png", sizes: "150x150", type: "image/png" }
    ]
  }
})

]
});
