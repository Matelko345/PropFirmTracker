import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const isElectron = process.env.ELECTRON === '1'

export default defineConfig({
  base: './',
  plugins: isElectron
    ? []
    : [
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icons/*.png'],
          manifest: {
            name: 'PropFirm Tracker',
            short_name: 'PropFirm',
            description: 'Tracker evalów i payoutów prop firm',
            theme_color: '#0a0b0f',
            background_color: '#0a0b0f',
            display: 'standalone',
            orientation: 'any',
            start_url: '/',
            lang: 'pl',
            icons: [
              {
                src: 'icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: 'icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
              },
              {
                src: 'icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            navigateFallback: 'index.html',
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'fx-cdn',
                  expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                },
              },
              {
                urlPattern: /^https:\/\/api\.nbp\.pl\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'nbp-fx',
                  expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                },
              },
            ],
          },
        }),
      ],
})
