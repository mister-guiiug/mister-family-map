import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaSeoPlugin } from '@mister-guiiug/dev-wpa-config/vite-pwa-base';
import { cspPlugin } from '@mister-guiiug/dev-wpa-config/vite-csp';

// Hôtes externes réellement utilisés — toute évolution DOIT être répercutée
// ici ET dans docs/THREAT-MODEL.md (section CSP).
const OSM_TILE_HOSTS = ['https://tile.openstreetmap.org'];
const SUPABASE_HOSTS = ['https://*.supabase.co', 'wss://*.supabase.co'];
const NOMINATIM_HOST = 'https://nominatim.openstreetmap.org';

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    pwaSeoPlugin({
      siteName: 'Mister Family Map',
    }),
    // Après pwaSeoPlugin (ordre requis : les hash sont calculés sur le HTML final).
    cspPlugin({
      dev: command === 'serve',
      // MapLibre récupère les tuiles raster via `fetch` → elles relèvent de
      // `connect-src` (et non de `img-src` comme avec une balise <img>).
      // `img-src` garde les mêmes hôtes pour le repli <img> des navigateurs
      // sans `createImageBitmap`.
      connectSrc: [
        "'self'",
        ...OSM_TILE_HOSTS,
        ...SUPABASE_HOSTS,
        NOMINATIM_HOST,
      ],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        ...OSM_TILE_HOSTS,
        ...SUPABASE_HOSTS,
      ],
    }),
    VitePWA({
      // Mise à jour contrôlée : l'utilisateur est prévenu (UpdatePromptBanner)
      // et déclenche lui-même le rechargement — jamais de reload silencieux.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icon-*.png'],
      manifest: {
        name: 'Mister Family Map',
        short_name: 'FamilyMap',
        description:
          'Idées de sorties en famille : carte collaborative, agenda et retours d’expérience.',
        lang: 'fr',
        start_url: '.',
        display: 'standalone',
        background_color: '#fdfaf5',
        theme_color: '#2f6f4f',
        icons: [
          // Icônes TEMPORAIRES (pictogramme générique) — régénérer depuis le
          // vrai logo avec `npm run icons` (bin pwa-icons du paquet partagé).
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Shell applicatif précaché → l'app démarre hors ligne ; les données
        // (lieux, favoris) sont servies par les adaptateurs locaux (IDB/LS).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Nettoyage des caches des versions précédentes du service worker.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Tuiles OSM récemment affichées : cache BORNÉ (200 tuiles, 7 j).
            // Ce n'est PAS une carte hors ligne complète — comportement
            // documenté dans docs/adr/0001-map-provider.md.
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Volontairement AUCUN runtime cache sur *.supabase.co : les données
          // personnelles (session, favoris, contributions) ne doivent jamais
          // atterrir dans un cache HTTP non contrôlé. Le hors-ligne des favoris
          // passe par le stockage applicatif explicite (shared/api/local).
        ],
      },
    }),
  ],
}));
