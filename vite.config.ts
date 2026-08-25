import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaSeoPlugin } from '@mister-guiiug/dev-wpa-config/vite-pwa-base';
import { cspPlugin } from '@mister-guiiug/dev-wpa-config/vite-csp';
import {
  mapCspDirectives,
  mapTileRuntimeCaching,
  osmRasterTiles,
} from '@mister-guiiug/dev-wpa-config/map';

// Source de tuiles : décrite UNE fois, puis dérivée en CSP et en cache — plus
// d'hôtes recopiés à la main entre le plugin CSP et workbox.
const MAP_TILES = osmRasterTiles();
const MAP_CSP = mapCspDirectives(MAP_TILES);

// Autres hôtes externes — toute évolution DOIT être répercutée ici ET dans
// docs/THREAT-MODEL.md (section CSP).
const SUPABASE_HOSTS = ['https://*.supabase.co', 'wss://*.supabase.co'];
const NOMINATIM_HOST = 'https://nominatim.openstreetmap.org';

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH ?? '/',
  optimizeDeps: {
    // L'adaptateur MapLibre du paquet partagé résout l'URL de son worker par
    // le suffixe Vite `?worker&url`. Le pré-bundling des dépendances ne sait
    // pas interpréter ce suffixe et échoue au démarrage de `npm run dev` —
    // alors que le build de production, lui, le gère. On sort donc ce
    // sous-chemin de l'optimiseur ; Vite le sert alors tel quel.
    exclude: ['@mister-guiiug/dev-wpa-config/map/maplibre'],
  },
  plugins: [
    react(),
    tailwindcss(),
    pwaSeoPlugin({
      siteName: 'Mister Family Map',
    }),
    // Après pwaSeoPlugin (ordre requis : les hash sont calculés sur le HTML final).
    cspPlugin({
      dev: command === 'serve',
      // `mapCspDirectives` place les hôtes de tuiles dans connect-src ET
      // img-src : MapLibre charge par `fetch`, Leaflet et le repli des
      // navigateurs sans `createImageBitmap` par <img>.
      connectSrc: [
        "'self'",
        ...MAP_CSP.connectSrc,
        ...SUPABASE_HOSTS,
        NOMINATIM_HOST,
      ],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        ...MAP_CSP.imgSrc,
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
          // Tuiles récemment affichées : cache BORNÉ (200 tuiles, 7 j), dérivé
          // de la même source que la CSP. Ce n'est PAS une carte hors ligne
          // complète — comportement documenté dans docs/adr/0001-map-provider.md.
          mapTileRuntimeCaching(MAP_TILES, { cacheName: 'osm-tiles' }),
          // Volontairement AUCUN runtime cache sur *.supabase.co : les données
          // personnelles (session, favoris, contributions) ne doivent jamais
          // atterrir dans un cache HTTP non contrôlé. Le hors-ligne des favoris
          // passe par le stockage applicatif explicite (shared/api/local).
        ],
      },
    }),
  ],
}));
