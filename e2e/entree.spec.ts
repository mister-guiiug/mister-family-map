import { test, expect } from '@playwright/test';
import { expectEcranEntreeCable } from '@mister-guiiug/dev-pwa-config/playwright-entree';

/*
 * L'ÉCRAN D'ENTRÉE, VÉRIFIÉ LÀ OÙ IL CASSE.
 *
 * Trois fois en un mois, une pièce à effet de bord s'est retrouvée montée
 * DERRIÈRE la porte d'une app du parc : `registerSW` d'abord — donc aucun
 * service worker et rien en cache —, le bandeau de consentement ensuite — donc
 * la question jamais posée —, la vue de page enfin — donc aucune remontée.
 *
 * À chaque fois le composant était bien écrit, les tests unitaires verts, la CI
 * verte, et le défaut trouvé EN PRODUCTION. Cette spec ne teste pas un
 * composant, elle teste une PLACE : celle où se tient un visiteur qui n'est pas
 * encore entré, et qui n'entrera peut-être jamais.
 *
 * Elle vise la RACINE et pas une route interne : cette app s'ouvre en visiteur,
 * et c'est l'accueil que voit quelqu'un qui arrive par le lien public.
 */
test.describe('@critical écran d’entrée', () => {
  test('la question est posée, une vue part, le service worker s’enregistre', async ({
    page,
  }) => {
    await expectEcranEntreeCable(page, expect, { url: '/' });
  });
});
