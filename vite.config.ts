import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "My Activity App",
    short_name: "Activity",
    theme_color: "#fbbf24", // matches mustard UI
    background_color: "#ffffff",
    display: "standalone",
    icons: [
          {
            src: "/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
  }
})
]
});
