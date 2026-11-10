import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HALQA — study circle',
        short_name: 'HALQA',
        description:
          'AI-mediated peer learning circle. Peers first, Nova balances, verifies and lights the way.',
        lang: 'fr',
        theme_color: '#123047',
        background_color: '#f4f7f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
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
