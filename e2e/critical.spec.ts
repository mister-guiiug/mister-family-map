import { expect, test, type Page } from '@playwright/test';

/**
 * Parcours E2E critiques (tag @critical — exécutés par la CI sur Chromium).
 * Ils tournent sur le backend local-first (seed lyonnais), sans réseau externe.
 */

async function signIn(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page
    .getByRole('button', { name: 'Recevoir le lien de connexion' })
    .click();
  await expect(page.getByText(/Connecté en tant que/)).toBeVisible();
}

test('@critical un visiteur consulte la carte et ouvre un lieu', async ({
  page,
}) => {
  await page.goto('/carte');
  // La carte est montée (fournisseur MapLibre GL) avec son alternative textuelle.
  await expect(page.getByTestId('map-container')).toBeVisible();
  // La liste synchronisée présente les mêmes résultats : on ouvre une fiche.
  await page
    .getByRole('link', { name: 'Parc de la Tête d’Or' })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Parc de la Tête d’Or' })
  ).toBeVisible();
  await expect(
    page.getByText('Retours d’expérience', { exact: false })
  ).toBeVisible();
});

test('@critical un membre ajoute un lieu et le système propose les doublons', async ({
  page,
}) => {
  await signIn(page, 'famille@exemple.fr');
  await page.goto('/lieux/nouveau');

  // Étape 1 : position (le centre de la carte fait foi) — coordonnées saisies
  // à la main pour se placer près d'un lieu existant du seed.
  await page.getByLabel('Latitude').fill('45.7799');
  await page.getByLabel('Longitude').fill('4.8529');
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Étape 2 : détection de doublons sur le nom + la proximité.
  await page.getByLabel('Nom du lieu').fill('Parc Tête d’Or');

  // La suggestion dépend de TROIS entrées : le nom saisi, les coordonnées du
  // brouillon, et la liste des lieux chargée depuis le backend local. Une
  // assertion nue ne dit pas laquelle manque — et ce parcours a échoué sur le
  // runner de CI sans qu'on sache le reproduire ailleurs, trois fois de suite,
  // en ne disant rien d'autre que « element(s) not found ».
  try {
    await expect(
      page.getByTestId('duplicate-suggestion').first()
    ).toBeVisible();
  } catch (error) {
    const etat = await page.evaluate(() => {
      const lire = (cle: string) => {
        try {
          return localStorage.getItem(cle);
        } catch {
          return '<stockage indisponible>';
        }
      };
      const lieux = lire('mfm_places');
      return {
        brouillon: lire('mfm_place_wizard_draft'),
        nbLieux: lieux ? (JSON.parse(lieux) as unknown[]).length : null,
        clesStockage: Object.keys(localStorage),
        titreEtape: document.querySelector('h1, h2')?.textContent ?? null,
      };
    });
    throw new Error(
      `${(error as Error).message}\n\nÉtat au moment de l'échec :\n${JSON.stringify(etat, null, 2)}`
    );
  }

  // On assume un lieu distinct et on poursuit le parcours.
  await page.getByLabel('Nom du lieu').fill('Kiosque à musique du parc');
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Étape 3 : essentiel.
  await page.getByLabel('Catégorie').selectOption({ label: 'Parc' });
  await page.getByLabel('Commune').fill('Lyon');
  await page
    .getByLabel('Description courte')
    .fill('Petit kiosque avec pelouse ombragée, parfait pour le goûter.');
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Étapes 4-6 : famille (défauts « je ne sais pas ») → photos → aperçu.
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Kiosque à musique du parc')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Étape 7 : règles puis envoi.
  await page.getByLabel(/J’accepte les règles/).check();
  await page.getByRole('button', { name: 'Envoyer la contribution' }).click();

  // La fiche créée s'affiche, en attente de validation.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Kiosque à musique du parc' })
  ).toBeVisible();
  await expect(page.getByText('En attente de validation')).toBeVisible();
});

test('@critical un membre propose un événement', async ({ page }) => {
  await signIn(page, 'famille@exemple.fr');
  await page.goto('/agenda/nouveau');
  await page.getByLabel('Titre').fill('Chasse aux trésors du quartier');
  await page
    .getByLabel('Catégorie')
    .selectOption({ label: 'Événement ponctuel' });
  await page.getByLabel('Début').fill('2027-05-15T10:00');
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Chasse aux trésors du quartier',
    })
  ).toBeVisible();
});

test('@critical un visiteur filtre les activités pour une date', async ({
  page,
}) => {
  await page.goto('/agenda');
  // La fête d'automne du seed couvre le 19-20 septembre 2026.
  await page.getByLabel('Choisir une date').fill('2026-09-19');
  await expect(
    page.getByRole('link', { name: 'Fête d’automne du parc Blandan' }).first()
  ).toBeVisible();
  // Un jour vide reste un état compréhensible, pas une page cassée.
  await page.getByLabel('Choisir une date').fill('2026-11-03');
  await expect(page.getByText('Aucun événement ce jour-là.')).toBeVisible();
});

test('@critical un modérateur traite un signalement', async ({ page }) => {
  // Un membre signale une fiche.
  await signIn(page, 'famille@exemple.fr');
  await page.goto('/lieux/seed-parc-blandan');
  await page.getByRole('button', { name: 'Signaler' }).click();
  await page
    .getByLabel('Motif')
    .selectOption({ label: 'Information incorrecte' });
  await page
    .getByLabel('Précisions')
    .fill('L’aire de jeux est fermée pour travaux.');
  await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(page.getByText(/transmis à la modération/)).toBeVisible();

  // Un modérateur le traite ; la décision est historisée.
  await signIn(page, 'modo@demo.famille');
  await page.goto('/moderation');
  await expect(page.getByText('Information incorrecte').first()).toBeVisible();
  await page
    .getByRole('button', { name: 'Valider le contenu' })
    .first()
    .click();
  await expect(page.getByText('Rien à traiter')).toBeVisible();
  await expect(page.getByText(/approve/).first()).toBeVisible();
});

test('@critical hors ligne : l’app reste utilisable sur les données locales', async ({
  page,
  context,
}) => {
  // Chargement initial en ligne : accueil puis favoris (les chunks des routes
  // déjà visitées sont en mémoire ; en production le service worker les
  // précache tous — ici on valide le comportement dev/app shell).
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Parc de la Tête d’Or' }).first()
  ).toBeVisible();
  await page.getByRole('link', { name: 'Favoris' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Favoris' })
  ).toBeVisible();

  // Coupure réseau : bannière hors-ligne + navigation SPA + données locales.
  await context.setOffline(true);
  await expect(page.getByText(/Hors ligne —/)).toBeVisible();
  await page.getByRole('link', { name: 'Explorer' }).click();
  await expect(
    page.getByRole('link', { name: 'Parc de la Tête d’Or' }).first()
  ).toBeVisible();
  await context.setOffline(false);
});
