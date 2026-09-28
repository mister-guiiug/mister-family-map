# mister-family-map

Carte collaborative d'idées de sorties en famille : lieux testés, agenda
d'événements et retours d'expérience **réellement utiles** (pas de descriptions
promotionnelles). PWA mobile-first, hors-ligne raisonné, privacy by design.
Le site publié n'a pas encore de serveur de données : ses lieux sont des
exemples lyonnais, et ce qu'un visiteur ajoute reste dans son navigateur, sans
être partagé.

> Construit sur le socle partagé
> [`@mister-guiiug/dev-pwa-config`](https://github.com/mister-guiiug/dev-pwa-config)
> (version : voir `package.json`).
> Audit de compatibilité, état du 21/08/2026 : [docs/AUDIT-DEV-WPA-CONFIG.md](./docs/AUDIT-DEV-WPA-CONFIG.md).

## Démarrage

Prérequis : la version de Node de `.nvmrc` (minimum dans `engines` du
`package.json`) et un accès GitHub Packages pour le scope `@mister-guiiug`
(PAT `read:packages`, cf. [README du paquet partagé](https://github.com/mister-guiiug/dev-pwa-config#installation-github-packages)) :

```bash
npm login --scope=@mister-guiiug --auth-type=legacy --registry=https://npm.pkg.github.com
npm ci
npm run dev
```

Sans configuration, l'app tourne en **backend local** (localStorage + données
de démonstration lyonnaises) : consultable, contribuable et testable sans
serveur. C'est le mode du site publié, où aucun Supabase n'est branché.
Comptes de démonstration : n'importe quel e-mail (`membre`),
`modo@…` (modérateur), `admin@…` (administrateur).

Pour brancher Supabase : appliquer `supabase/migrations/`, puis définir
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (cf. [supabase/README.md](./supabase/README.md)).

## Commandes

| Commande                                 | Rôle                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`                            | Serveur de développement                                                      |
| `npm run format:check` / `format`        | Prettier (config famille)                                                     |
| `npm run lint`                           | ESLint (flat config famille, a11y en warn)                                    |
| `npm run type-check`                     | `tsc -b` strict (ES2025, verbatimModuleSyntax)                                |
| `npm test` / `test:coverage`             | Vitest (jsdom) — domaine + composants + ports                                 |
| `npm run test:e2e` / `test:e2e:critical` | Playwright (parcours critiques `@critical`, a11y `@a11y`)                     |
| `npm run build`                          | `tsc -b` + Vite 8 + PWA (précache + manifest) + `pwa-bundle-budget`           |
| `npm run icons`                          | Régénère les icônes PWA depuis `public/favicon.svg` (bin famille `pwa-icons`) |
| `npm run verify`                         | Portail qualité complet (format + lint + types + tests + build)               |

## Architecture

```
src/
  app/          providers (Backend), router, layouts (nav 5 onglets), config (env, backend)
  pages/        écrans (lazy) : Explorer, Carte, fiche/ajout lieu, Agenda, fiche/ajout
                événement, Favoris, Connexion, Profil, Contributions, Modération, 404…
  features/     par domaine fonctionnel : map (port + adaptateur MapLibre GL du paquet partagé),
                search (store filtres), places, events, reviews, contributions (wizard),
                favorites, auth
  entities/     modèles + schémas Zod + logique métier pure (place, event, review,
                user/permissions, category, moderation)
  shared/
    api/        ports.ts (11 interfaces) · local/ (adaptateurs local-first + seed)
                · supabase/ (client + adaptateur de référence places)
    lib/        dates, dedupe, id, recommend, sanitize, rate-limit : pur et testé
                (géo, iCal, validation d'image et clustering viennent du paquet partagé)
    schemas/    filtres de recherche (tri-état : oui / non / inconnu)
    hooks/ components/ constants/ styles/ types/
```

Règles : la logique métier vit dans `entities/` et `shared/lib/` (pas dans les
composants) ; les écrans ne dépendent que des **ports** (`shared/api/ports.ts`) ;
un seul fichier importe supabase-js. La carte n'est plus implémentée ici : le
port `MapProvider`, l'adaptateur MapLibre, le regroupement de marqueurs et les
helpers CSP/cache viennent de
[`@mister-guiiug/dev-pwa-config/map`](https://github.com/mister-guiiug/dev-pwa-config/blob/main/docs/DONNEES.md#carte-mister-guiiugdev-pwa-configmap).

Décisions documentées : [ADR-0001 carte](./docs/adr/0001-map-provider.md) ·
[ADR-0002 backend](./docs/adr/0002-backend.md) ·
[ADR-0003 export ICS](./docs/adr/0003-export-calendrier.md) ·
[ADR-0004 magasin versionné](./docs/adr/0004-magasin-versionne.md) ·
[ADR-0005 annuler plutôt que confirmer](./docs/adr/0005-annuler-plutot-que-confirmer.md) ·
[ADR-0006 export des contributions](./docs/adr/0006-export-des-contributions.md) ·
[ADR-0007 le message porte la valeur](./docs/adr/0007-le-message-porte-la-valeur.md) ·
[modèle de données](./docs/DATA-MODEL.md) ·
[modèle de menaces](./docs/THREAT-MODEL.md).

L'état local vit sous **une clé versionnée** (`mfm_data`), pas sous les neuf
clés `mfm_*` d'avant : une évolution du modèle ne vide plus l'application, et
la migration `0 → 1` relit les anciennes clés sans rien perdre (ADR-0004).

## Observabilité

Au démarrage (`src/main.tsx`), `installObservability()` capture les erreurs non
rattrapées et `installCorrelation()` pose l'identifiant qui les relie :

| Canal                                                    | Ce qu'il porte                                |
| -------------------------------------------------------- | --------------------------------------------- |
| Journal d'erreurs local (sans envoi, Sentry non branché) | `correlationId` en contexte de session        |
| Requêtes Supabase                                        | en-têtes `X-Correlation-Id` et `X-Session-Id` |
| Écran de crash (`ObservabilityBoundary`)                 | la référence à citer au support               |

Mesure d'audience : PostHog (nuage européen), chargé seulement après accord
dans le bandeau `ConsentBanner`. Il compte les pages vues et les créations de
lieu ou d'événement (le type seul, jamais le contenu). Sans `VITE_POSTHOG_KEY`,
le bandeau ne s'affiche pas et rien n'est mesuré.

Le journal nommé (`createLogger`) remplace les `console.warn` qui
disparaissaient dans la console de l'utilisateur : ses lignes rejoignent le fil
d'Ariane joint aux erreurs.

## Sécurité & vie privée (résumé)

- Géolocalisation uniquement sur action explicite, jamais persistée.
- Aucune donnée nominative sur les enfants (tranches d'âge anonymes).
- Avec la dorsale Supabase, pas encore branchée sur le site publié : RLS par
  table et par opération, et le client n'est jamais cru sur son rôle. Statut et
  auteur sont imposés par triggers sur les lieux ; les autres contributions
  n'ont pas encore cette garde.
- Photos : types et tailles contrôlés ; aucune photo n'est encore enregistrée
  ni envoyée (voir « Restes à faire connus »).
- CSP durcie à la build (hash SHA-256, hôtes explicites), aucun secret dans le
  code — la clé anon Supabase est publique par conception.
- Portabilité : « Exporter mes contributions » (Profil) écrit un JSON de tout
  ce que l'utilisateur a saisi, supprimé compris (ADR-0006) — c'est la
  promesse de la page « Mentions », désormais tenue.
- Suppression **logique** et réversible : « Annuler » huit secondes après le
  geste, puis une corbeille dans « Mes contributions » (ADR-0005). Aucune
  politique DELETE sur les lieux, les avis et les événements, aucune migration
  ajoutée.

Détails, menaces et restes à faire : [docs/THREAT-MODEL.md](./docs/THREAT-MODEL.md).

## CI/CD

Les workflows réutilisent ceux du socle, à l'étiquette `v6` : `ci.yml`
(format, lint, types, tests, build, E2E), `deploy.yml` (GitHub Pages) et
`lighthouse.yml`. `npm run verify` en rejoue l'essentiel en local, sans E2E ni
diagnostic `pwa-doctor`.

## Hooks git (optionnel, recommandé)

`commitlint.config.js` et `lint-staged.config.js` sont prêts. Pour activer :

```bash
npm i -D husky @commitlint/cli @commitlint/config-conventional lint-staged
npx husky init
# puis copier dev-pwa-config/templates/husky/{pre-commit,commit-msg}
```

## Restes à faire connus

- Adaptateurs Supabase des ports restants (patron : `supabase-place-repository.ts`).
  Un seul port sur onze est branché : en mode `supabase`, tout le reste — dont
  les contributions saisies — vit encore dans le navigateur.
- Restaurer un lieu **publié** depuis la corbeille le renvoie en file de
  validation : le trigger `reset_place_status_on_author_update` repasse en
  `pending` toute écriture d'un non-modérateur, `deleted_at` compris. L'exempter
  demanderait une migration — à rouvrir avec les ports Supabase manquants
  (ADR-0005).
- Réimport du fichier d'export (l'export seul est promis par la page
  « Mentions » ; `createVersionedStore` fournit déjà `import()` si le besoin
  vient — ADR-0006).
- Téléversement des photos : l'étape « photos » contrôle le type et la taille,
  puis ignore le fichier. Le ré-encodage qui retire EXIF et GPS est à câbler
  avec lui.
- Garde serveur du statut et de l'auteur sur les contributions autres que les
  lieux, avant de brancher Supabase.
- Limitation de débit côté serveur avant ouverture publique (cf. THREAT-MODEL).
- Icônes définitives (les icônes actuelles sont un pictogramme provisoire).
- Textes légaux définitifs (pages actuelles marquées « provisoires »).
- Découpage du bundle principal (supabase-js peut être chargé dynamiquement).
