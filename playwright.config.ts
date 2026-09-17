import { defineConfig, devices } from '@playwright/test';
import { definePwaPlaywrightConfig } from '@mister-guiiug/dev-pwa-config/playwright-base';

// Factory famille : matrice navigateurs, reporters multi-format, snapshots par
// plateforme, `reducedMotion`, `webServer` inclus. `devices` est passé en
// argument (le paquet partagé n'importe pas @playwright/test).
//
// LES E2E TESTENT UN BUILD, PLUS UN SERVEUR DE DÉVELOPPEMENT. C'est ce que
// demande la garde de l'écran d'entrée (`e2e/entree.spec.ts`) : sa troisième
// vérification est qu'un service worker s'enregistre, et Vite n'en enregistre
// aucun en mode `dev`. Sur un serveur de développement, il aurait fallu écrire
// `serviceWorker: false` — c'est-à-dire renoncer à la vérification qui a le
// plus de valeur, celle qui a trouvé le défaut d'origine : `registerSW` monté
// derrière la porte, donc aucun cache et aucune existence hors ligne.
//
// `--mode e2e` charge `.env.e2e`, qui pose l'identifiant de mesure factice sans
// toucher au développement ni à la production. Port 4173 pour ne pas
// collisionner avec un `npm run dev` (5173), et `base` reste `/` : les douze
// navigations des autres specs (`/carte`, `/profil`, …) sont écrites en
// chemins absolus depuis la racine.
export default defineConfig(
  definePwaPlaywrightConfig({
    devices,
    preview: true,
    port: 4173,
    command:
      'npx vite build --mode e2e && npx vite preview --port 4173 --strictPort',
  })
);
