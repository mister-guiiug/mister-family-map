import { defineConfig, devices } from '@playwright/test';
import { definePwaPlaywrightConfig } from '@mister-guiiug/dev-wpa-config/playwright-base';

// Factory famille : matrice navigateurs, reporters multi-format, snapshots par
// plateforme, `reducedMotion`, `webServer` inclus. `devices` est passé en
// argument (le paquet partagé n'importe pas @playwright/test).
export default defineConfig(
  definePwaPlaywrightConfig({
    devices,
    port: 5173,
  })
);
