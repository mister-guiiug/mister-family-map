import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {
  baseTestOptions,
  coveragePreset,
  pwaRegisterAlias,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

export default defineConfig({
  plugins: [react()],
  // `virtual:pwa-register` n'est fourni que par vite-plugin-pwa, absent d'ici :
  // sans ce double, tout test qui le monte échoue à l'import, avant d'avoir
  // rien éprouvé. Le double du socle est PILOTABLE (`swStub.needRefresh()`),
  // là où la copie locale était muette.
  resolve: { alias: { ...pwaRegisterAlias } },
  test: {
    ...baseTestOptions,
    coverage: {
      ...coveragePreset,
      provider: 'v8',
      // Périmètre : logique métier pure (entités + lib partagée). Les
      // composants sont couverts par les tests composants et le filet E2E.
      include: ['src/entities/**', 'src/shared/lib/**'],
    },
  },
});
