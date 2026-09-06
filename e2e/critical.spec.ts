import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  dumpAppState,
  rethrowWithState,
} from '@mister-guiiug/dev-pwa-config/playwright-base';
import type { ContributionsExport } from '../src/features/contributions/export';

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
  // Le dump vient désormais du socle (`dumpAppState`) : c'est ce try/catch,
  // écrit ici à la main, qui a été promu — il avait livré la coordonnée
  // fautive après trois échecs muets. `evaluate` garde le décompte propre à
  // l'app, que le dump générique ne peut pas connaître.
  try {
    await expect(
      page.getByTestId('duplicate-suggestion').first()
    ).toBeVisible();
  } catch (error) {
    rethrowWithState(
      error,
      await dumpAppState(page, {
        keys: ['mfm_place_wizard_draft'],
        evaluate: () => {
          const lieux = localStorage.getItem('mfm_places');
          return {
            nbLieux: lieux ? (JSON.parse(lieux) as unknown[]).length : null,
          };
        },
      })
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
  // Le bandeau attend 1,5 s de coupure CONTINUE avant de parler (il ne doit
  // pas clignoter sur une micro-coupure) : l'attente d'assertion, à 10 s, le
  // couvre largement.
  await context.setOffline(true);
  await expect(page.getByText(/Hors ligne —/)).toBeVisible();
  await page.getByRole('link', { name: 'Explorer' }).click();
  await expect(
    page.getByRole('link', { name: 'Parc de la Tête d’Or' }).first()
  ).toBeVisible();
  await context.setOffline(false);
});

test('@critical la version de l’app est lisible dans « À propos »', async ({
  page,
}) => {
  // Le numéro doit être ATTEIGNABLE par un utilisateur qui remplit un rapport
  // de bug — pas seulement présent dans le bundle. La première mise en place
  // câblait `versionPlugin()` sans rien afficher : la version existait dans
  // `globalThis.__DWC_BUILD__` et dans le contexte d'erreur, et restait
  // invisible à l'écran.
  await page.goto('/profil');

  const version = page.locator('[data-dwc="app-version"]');
  await expect(version).toBeVisible();

  // Un numéro, pas un « v » orphelin ni « undefined ».
  await expect(version.locator('[data-dwc="app-version-value"]')).toHaveText(
    /^\d+\.\d+\.\d+/
  );

  // Et il mène à la release correspondante.
  await expect(
    version.locator('a[data-dwc="app-version-value"]')
  ).toHaveAttribute('href', /\/releases\/tag\/v\d+\.\d+\.\d+$/);
});

test('@critical le profil offre la mise à jour forcée, le code source, le café et les autres apps', async ({
  page,
}) => {
  // Trois composants du socle vivaient dans le paquet sans être montés nulle
  // part : le bouton « Forcer la mise à jour » (le seul recours quand le
  // bandeau n'apparaît pas, faute de version déjà vue par le navigateur), le
  // lien code source, le lien sponsor et la grille des applications de la
  // famille. Livrés dans le paquet ne veut pas dire visibles à l'écran — la
  // version l'avait déjà démontré.
  await page.goto('/profil');

  await expect(page.locator('[data-dwc="update-button"]')).toBeVisible();

  const source = page.locator('[data-dwc="family-source"]');
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');

  const sponsor = page.locator('[data-dwc="family-sponsor"]');
  await expect(sponsor).toBeVisible();
  await expect(sponsor).toHaveAttribute('href', /buymeacoffee\.com/);

  // La grille des autres apps, alimentée par le catalogue du socle.
  await expect(page.locator('[data-dwc="family-app"]').first()).toBeVisible();

  // Le partage, et sa zone de retour : la région `status` doit exister AVANT
  // d'avoir quelque chose à dire, sans quoi son message ne serait pas annoncé.
  await expect(page.locator('[data-dwc="share-button"]')).toBeVisible();
  await expect(
    page.locator('[data-dwc="share-button-status"]')
  ).toHaveAttribute('role', 'status');
});

test('@critical approcher un onglet précharge sa page', async ({ page }) => {
  // Les treize pages sont découpées en `lazy()`. Le service worker les
  // précache — mais à partir de la DEUXIÈME visite seulement. À la première,
  // celle qui décide si la famille revient, ouvrir « Carte » attend le réseau
  // derrière un squelette, et MapLibre GL pèse 989 ko.
  //
  // Ce test est marqué `@critical` parce que c'est la seule suite que la CI
  // exécute : un préchargement qui cesse de fonctionner ne casse rien, il rend
  // simplement l'app lente à nouveau — exactement le genre de régression qui
  // passe inaperçue jusqu'à ce qu'un utilisateur s'en plaigne.
  const scripts: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Explorer' })).toBeVisible();
  await page.waitForTimeout(500);
  scripts.length = 0;

  // Le pointeur approche de l'onglet — sans cliquer.
  await page.getByRole('link', { name: 'Carte' }).hover();

  await expect
    .poll(() => scripts.filter(url => /MapPage/.test(url)).length, {
      message: 'le morceau de la carte doit partir AVANT le clic',
      timeout: 5000,
    })
    .toBeGreaterThan(0);

  // Et la page n'a pas changé : on a préchargé, pas navigué.
  await expect(page).toHaveURL(/\/$|\/index\.html$/);
});

test('@critical deux onglets restent d’accord sur les favoris', async ({
  page,
  context,
}) => {
  // Deux onglets partagent le localStorage mais pas leurs stores React :
  // avant le câblage du canal inter-onglets (port temps réel du socle,
  // transport BroadcastChannel), ajouter un favori dans l'un ne changeait
  // RIEN dans l'autre avant un rechargement — deux vues de la même donnée,
  // qui se contredisent en silence.
  //
  // C'est aussi le banc d'essai du port : conçu sans usage réel à
  // généraliser, il est ici éprouvé en conditions réelles — même contrat que
  // les adaptateurs Supabase et Firestore.
  const explorateur = page;
  const favoris = await context.newPage();

  await explorateur.goto('/');
  await favoris.goto('/favoris');
  await expect(favoris.getByText('Aucun favori pour l’instant')).toBeVisible();

  // L'onglet A ajoute — l'onglet B doit le voir SANS rechargement.
  await explorateur
    .getByRole('button', { name: 'Ajouter Parc de la Tête d’Or aux favoris' })
    .first()
    .click();

  await expect(
    favoris.getByRole('link', { name: 'Parc de la Tête d’Or' }).first()
  ).toBeVisible();

  // Et le retrait fait le chemin inverse.
  await explorateur
    .getByRole('button', { name: 'Retirer Parc de la Tête d’Or des favoris' })
    .first()
    .click();
  await expect(favoris.getByText('Aucun favori pour l’instant')).toBeVisible();
});

/* ── Ce que la page « Mentions » promet, et ce qu'un regret coûte ────────── */

test('@critical un membre exporte ses contributions, et le fichier les contient', async ({
  page,
}) => {
  // La promesse écrite en page « Mentions » : « Vous pouvez supprimer votre
  // compte et exporter vos contributions depuis le profil. » Ce parcours est
  // la seule chose qui la vérifie de bout en bout : un test unitaire prouve le
  // CONTENU du fichier, pas qu'un fichier sorte du navigateur.
  await signIn(page, 'famille@exemple.fr');

  // Une contribution repérable, pour que le fichier ait quelque chose à dire.
  await page.goto('/agenda/nouveau');
  await page.getByLabel('Titre').fill('Atelier cerfs-volants');
  await page
    .getByLabel('Catégorie')
    .selectOption({ label: 'Événement ponctuel' });
  await page.getByLabel('Début').fill('2027-06-12T14:00');
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Atelier cerfs-volants' })
  ).toBeVisible();

  await page.goto('/profil');
  const telechargement = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Exporter mes contributions' })
    .click();
  const fichier = await telechargement;

  // Le nom porte la date du jour — on n'affirme que la forme, la date étant
  // celle de la machine qui joue le test.
  expect(fichier.suggestedFilename()).toMatch(
    /^mister-family-map-contributions-\d{4}-\d{2}-\d{2}\.json$/
  );

  // Et le fichier est du JSON qui contient bien la contribution.
  const chemin = await fichier.path();
  const contenu = JSON.parse(
    await readFile(chemin, 'utf8')
  ) as ContributionsExport;
  expect(contenu.app).toBe('mister-family-map');
  expect(contenu.events.map(e => e.title)).toContain('Atelier cerfs-volants');
});

test('@critical supprimer une contribution, l’annuler, la retrouver', async ({
  page,
}) => {
  await signIn(page, 'famille@exemple.fr');
  await page.goto('/agenda/nouveau');
  await page.getByLabel('Titre').fill('Balade contée au crépuscule');
  await page
    .getByLabel('Catégorie')
    .selectOption({ label: 'Événement ponctuel' });
  await page.getByLabel('Début').fill('2027-07-03T20:00');
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();

  await page.goto('/profil/contributions');
  const ligne = page.getByRole('link', {
    name: 'Balade contée au crépuscule',
  });
  await expect(ligne).toBeVisible();

  // 1. Supprimer : la ligne part, ET l'annulation est proposée — sans qu'aucun
  //    dialogue de confirmation n'ait été affiché avant le geste.
  await page
    .getByRole('button', { name: 'Supprimer l’événement Balade contée' })
    .click();
  await expect(ligne).toBeHidden();
  const annuler = page.getByRole('button', { name: 'Annuler' });
  await expect(annuler).toBeVisible();

  // 2. Annuler : la contribution revient.
  await annuler.click();
  await expect(ligne).toBeVisible();
});

test('@critical supprimer sans annuler : la corbeille rattrape, et restaure', async ({
  page,
}) => {
  // Le second filet, celui qui compte quand la notification est passée
  // inaperçue — téléphone rangé, onglet fermé, regret du lendemain.
  await signIn(page, 'famille@exemple.fr');
  await page.goto('/agenda/nouveau');
  await page.getByLabel('Titre').fill('Pique-nique des voisins');
  await page
    .getByLabel('Catégorie')
    .selectOption({ label: 'Événement ponctuel' });
  await page.getByLabel('Début').fill('2027-08-21T12:00');
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();

  await page.goto('/profil/contributions');
  // La corbeille n'existe pas tant qu'elle est vide : c'est délibéré, une
  // section vide en permanence s'apprend à ne plus être regardée.
  await expect(page.getByRole('region', { name: 'Corbeille' })).toBeHidden();

  await page
    .getByRole('button', { name: 'Supprimer l’événement Pique-nique' })
    .click();

  // On IGNORE la notification et on recharge : le délai de huit secondes est
  // passé, du point de vue de l'utilisateur la suppression est acquise.
  await page.reload();
  const corbeille = page.getByRole('region', { name: 'Corbeille' });
  await expect(corbeille).toBeVisible();
  await expect(corbeille.getByText('Pique-nique des voisins')).toBeVisible();

  await corbeille
    .getByRole('button', { name: 'Restaurer Pique-nique des voisins' })
    .click();

  // Restauré : de retour dans la liste, et la corbeille redevient invisible.
  await expect(
    page.getByRole('link', { name: 'Pique-nique des voisins' })
  ).toBeVisible();
  await expect(corbeille).toBeHidden();
});

test('@critical la carte se lit la nuit : la bascule de thème agit', async ({
  page,
}) => {
  // Les jetons `[data-theme='dark']` étaient dans le CSS depuis le premier
  // jour, sans aucun fournisseur monté : personne ne pouvait les atteindre.
  //
  // Ce test lit des ATTRIBUTS (`data-theme`, `data-theme-state`) et non le
  // libellé du bouton : ce libellé vient des traductions du socle, et Chromium
  // se présente en `en-US` — une assertion sur « Thème sombre » échouerait
  // ici pour une raison qui n'a rien à voir avec le thème.
  await page.goto('/profil');
  const bascule = page.locator('[data-dwc="theme-toggle"]');
  await expect(bascule).toBeVisible();

  const racine = page.locator('html');
  // Trois états, `system` en tête : c'est lui le défaut, et c'est lui qui suit
  // le coucher du soleil sans qu'on y pense.
  await expect(bascule).toHaveAttribute('data-theme-state', 'system');

  await bascule.click();
  await expect(bascule).toHaveAttribute('data-theme-state', 'light');
  await expect(racine).toHaveAttribute('data-theme', 'light');

  await bascule.click();
  await expect(bascule).toHaveAttribute('data-theme-state', 'dark');
  await expect(racine).toHaveAttribute('data-theme', 'dark');

  // Et le choix TIENT au rechargement — c'est le script anti-FOUC
  // d'`index.html` qui relit `dwc_theme`, écrite pour la première fois par ce
  // fournisseur.
  await page.reload();
  await expect(racine).toHaveAttribute('data-theme', 'dark');
});
