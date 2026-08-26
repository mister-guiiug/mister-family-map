import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {
  baseTestOptions,
  coveragePreset,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `virtual:pwa-register` n'est fourni que par vite-plugin-pwa, absent
      // d'ici : sans ce double, tout test qui monte le shell échoue à
      // l'import, avant d'avoir rien éprouvé.
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url)
      ),
    },
  },
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
