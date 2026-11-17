import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Tailwind is scoped to the landing page only (see src/styles/tailwind.css).
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HALQA — study circle',
        short_name: 'HALQA',
        description:
          'AI-mediated peer learning circle. Peers first, Nova balances, verifies and lights the way.',
        lang: 'fr',
        // Must track --navy-deep (night field): the installed splash and the
        // status bar render before any CSS is parsed, so they cannot inherit.
        theme_color: '#070f16',
        background_color: '#070f16',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the night-field backdrop. It is referenced by the shell,
        // landing and /enter, so a first load with no network would otherwise
        // paint the veil over nothing. Everything else in public/ is either
        // already in the manifest icons or runtime-cached.
        globPatterns: ['**/*.{js,css,html,svg,png,avif,webmanifest,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/questions\/.*\/state/,
            handler: 'NetworkFirst',
            options: { cacheName: 'halqa-state', networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: /\/api\/v1\/kb\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'halqa-kb' },
          },
        ],
      },
    }),
  ],
});
