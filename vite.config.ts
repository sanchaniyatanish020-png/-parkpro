import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'ParkPro — Parking Management',
        short_name: 'ParkPro',
        description:
          'Fast QR parking passes, gate scanning and walk-in entry for parking operators. Works offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait-primary',
        background_color: '#0B1F3A',
        theme_color: '#0B1F3A',
        lang: 'en-IN',
        dir: 'ltr',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Scan QR', short_name: 'Scan', url: '/scan', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Parked vehicles', short_name: 'Parked', url: '/parked', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Dashboard', short_name: 'Home', url: '/admin', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}', 'icons/*.png'],
        // Export/report libraries are downloaded on first use, not at install.
        // `index.es-*` is canvg, an internal jspdf dependency.
        globIgnores: ['**/xlsx-*.js', '**/jspdf*.js', '**/purify*.js', '**/html2canvas*.js', '**/index.es-*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Cache the on-demand export libraries after their first download.
            urlPattern: ({ url }) => /\/assets\/(?:xlsx-|jspdf|purify|html2canvas|index\.es-)/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'parkpro-heavy-libs',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Wire this to your real API. Passes are also mirrored in IndexedDB for offline scanning.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/passes'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'parkpro-passes',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'parkpro-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'parkpro-images',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          ui: ['clsx', 'tailwind-merge'],
          charts: ['recharts'],
          qr: ['qrcode'],
          scanner: ['jsqr'],
          imaging: ['html-to-image'],
        },
      },
    },
  },
})
