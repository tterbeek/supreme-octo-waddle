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
      "icons": [
        {
          "src": "public/icon-192x192.png",
          "sizes": "192x192",
          "type": "image/png"
        },
        {
          "src": "public/icon-512x512.png",
          "sizes": "512x512",
          "type": "image/png"
        },
        {
          "src": "public/icon-180x180.png",
          "sizes": "180x180",
          "type": "image/png"
        },
        {
          "src": "public/icon-256x256.png",
          "sizes": "256x256",
          "type": "image/png"
        },
        {
          "src": "public/icon-150x150.png",
          "sizes": "150x150",
          "type": "image/png"
        }
      ]
      }
})
]
});
