import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {
  baseTestOptions,
  coveragePreset,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

export default defineConfig({
  plugins: [react()],
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
