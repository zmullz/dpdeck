import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// DP Deck: single React component (dpdeck.jsx) mounted by main.jsx.
// Inline styles only, lucide-react for icons, no other UI libs.
// PWA: installable + offline (app shell precached). The film data is NOT bundled;
// it loads per device via Import (kept off the public web).
const BASE = process.env.GHPAGES ? "/dpdeck/" : "/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        // start_url/scope/id MUST match the deploy base (/dpdeck/ on GitHub Pages). With "/",
        // an installed iOS home-screen PWA opens the domain root and 404s — that was the bug.
        id: BASE,
        scope: BASE,
        start_url: BASE,
        name: "DP Deck",
        short_name: "DP Deck",
        description: "A private prep and shoot deck.",
        theme_color: "#121317",
        background_color: "#121317",
        display: "standalone",
        orientation: "any",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the app shell only. The deck data lives in IndexedDB, never precached.
        globPatterns: ["**/*.{js,css,html,png,svg,woff,woff2}"],
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: { port: 5173, open: false, host: true },
});
