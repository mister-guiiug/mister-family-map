import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectNoA11yViolations } from '@mister-guiiug/dev-pwa-config/playwright-a11y';

/**
 * Filet d'accessibilité automatisé (axe-core, WCAG A/AA) sur les écrans
 * principaux — adapté du template famille (templates/e2e/a11y.spec.ts).
 * Complète, sans remplacer, les tests manuels clavier/lecteur d'écran.
 */

const ROUTES: Array<[string, string]> = [
  ['accueil', '/'],
  ['agenda', '/agenda'],
  ['favoris', '/favoris'],
  ['connexion', '/connexion'],
  ['profil', '/profil'],
  ['fiche lieu', '/lieux/seed-tete-dor'],
];

for (const [label, route] of ROUTES) {
  test(`@a11y ${label} sans violation WCAG A/AA`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expectNoA11yViolations(page, AxeBuilder, expect);
  });
}
