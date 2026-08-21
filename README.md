# mister-family-map

Carte collaborative d'idées de sorties en famille : lieux testés, agenda
d'événements et retours d'expérience **réellement utiles** (pas de descriptions
promotionnelles). PWA mobile-first, hors-ligne raisonné, privacy by design.

> Squelette applicatif exécutable — construit sur les configurations partagées
> [`@mister-guiiug/dev-wpa-config`](https://github.com/mister-guiiug/dev-wpa-config) v3.10.1.
> Audit de compatibilité : [docs/AUDIT-DEV-WPA-CONFIG.md](./docs/AUDIT-DEV-WPA-CONFIG.md).

## Démarrage

Prérequis : Node ≥ 22 (`.nvmrc`) et un accès GitHub Packages pour le scope
`@mister-guiiug` (PAT `read:packages`, cf. [README du paquet partagé](https://github.com/mister-guiiug/dev-wpa-config#installation-github-packages)) :

```bash
npm login --scope=@mister-guiiug --auth-type=legacy --registry=https://npm.pkg.github.com
npm ci
npm run dev
```

Sans configuration, l'app tourne en **backend local** (localStorage + données
de démonstration lyonnaises) : consultable, contribuable et testable sans
serveur. Comptes de démonstration : n'importe quel e-mail (`membre`),
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
| `npm run build`                          | `tsc -b` + Vite 8 + PWA (précache + manifest)                                 |
| `npm run icons`                          | Régénère les icônes PWA depuis `public/favicon.svg` (bin famille `pwa-icons`) |
| `npm run verify`                         | Portail qualité complet (format + lint + types + tests + build)               |
| `npm run mirror` / `mirror:snapshot`     | Publication vers le dépôt public (cf. docs/MIRRORING.md)                      |

## Architecture

```
src/
  app/          providers (Backend), router, layouts (nav 5 onglets), config (env, backend)
  pages/        écrans (lazy) : Explorer, Carte, fiche/ajout lieu, Agenda, fiche/ajout
                événement, Favoris, Connexion, Profil, Contributions, Modération, 404…
  features/     par domaine fonctionnel : map (port MapProvider + adaptateur Leaflet),
                search (store filtres), places, events, reviews, contributions (wizard),
                favorites, auth, moderation
  entities/     modèles + schémas Zod + logique métier pure (place, event, review,
                user/permissions, category, moderation)
  shared/
    api/        ports.ts (11 interfaces) · local/ (adaptateurs local-first + seed)
                · supabase/ (client + adaptateur de référence places)
    lib/        geo, dates, cluster, dedupe, recommend, ics, sanitize, images,
                rate-limit — pur et testé
    schemas/    filtres de recherche (tri-état : oui / non / inconnu)
    hooks/ components/ constants/ styles/ types/
```

Règles : la logique métier vit dans `entities/` et `shared/lib/` (pas dans les
composants) ; les écrans ne dépendent que des **ports** (`shared/api/ports.ts`) ;
un seul fichier importe Leaflet, un seul importe supabase-js.

Décisions documentées : [ADR-0001 carte](./docs/adr/0001-map-provider.md) ·
[ADR-0002 backend](./docs/adr/0002-backend.md) ·
[ADR-0003 export ICS](./docs/adr/0003-export-calendrier.md) ·
[modèle de données](./docs/DATA-MODEL.md) ·
[modèle de menaces](./docs/THREAT-MODEL.md).

## Sécurité & vie privée (résumé)

- Géolocalisation uniquement sur action explicite, jamais persistée.
- Aucune donnée nominative sur les enfants (tranches d'âge anonymes).
- Autorité côté serveur : RLS par table et par opération, statuts et auteur
  imposés par triggers — le client n'est jamais cru sur son rôle.
- Photos ré-encodées côté client (EXIF/GPS supprimés), types et tailles
  contrôlés, modération a priori.
- CSP durcie à la build (hash SHA-256, hôtes explicites), aucun secret dans le
  code — la clé anon Supabase est publique par conception.

Détails, menaces et restes à faire : [docs/THREAT-MODEL.md](./docs/THREAT-MODEL.md).

## CI/CD — à coût zéro

Les minutes Actions ne sont pas disponibles sur ce dépôt privé : toute
l'automatisation s'exécute **gratuitement sur le miroir public**
`mister-guiiug/mister-family-map`, alimenté par `npm run mirror`.

Reusable workflows famille (permissions minimales au niveau caller), tous
gardés par `if: github.repository == 'mister-guiiug/mister-family-map'` —
`skipped` ici (0 minute, 0 rouge), exécutés sur le public :
`ci.yml` → `pwa-ci.yml@v3` (format · lint · type · test · build · audit npm ·
E2E `@critical`), `deploy.yml` → `pwa-deploy.yml@v3` (GitHub Pages publiques),
`lighthouse.yml` → `pwa-lighthouse.yml@v3`.

Côté privé, le portail qualité est **`npm run verify`**, exigé par le script
de publication avant tout push (et exécutable à tout moment, y compris par
les hooks git optionnels ci-dessous).

⚠️ Bootstrap lockfile : le `package-lock.json` a été généré sans accès
authentifié à GitHub Packages — l'entrée `@mister-guiiug/dev-wpa-config` est
volontairement sans `resolved`/`integrity` (`npm ci` fonctionne). Premier
contributeur : lancer `npm install` avec un accès au registre, committer le
lockfile complété, puis passer `verify-lockfile: true` dans `ci.yml`.

## Publication publique (mirroring)

Ce dépôt privé est le dépôt principal de développement. La version publiée
vit sur le dépôt public dédié
[`mister-guiiug/mister-family-map`](https://github.com/mister-guiiug/mister-family-map),
alimenté par **`npm run mirror`** depuis le poste de travail (aucune minute
Actions, aucun secret — vos identifiants git suffisent) : **seules la branche
`main` et les tags `v*` atteignables depuis `main`** y sont publiés, avec un
mode `snapshot` (`npm run mirror:snapshot`) pour publier un historique filtré
par `.github/mirror-exclude.txt`. Le contrôle qualité `npm run verify` est
exigé avant chaque publication. Détails : [docs/MIRRORING.md](./docs/MIRRORING.md).

## Hooks git (optionnel, recommandé)

`commitlint.config.js` et `lint-staged.config.js` sont prêts. Pour activer :

```bash
npm i -D husky @commitlint/cli @commitlint/config-conventional lint-staged
npx husky init
# puis copier dev-wpa-config/templates/husky/{pre-commit,commit-msg}
```

## Restes à faire connus

- Adaptateurs Supabase des ports restants (patron : `supabase-place-repository.ts`).
- Limitation de débit côté serveur avant ouverture publique (cf. THREAT-MODEL).
- Icônes définitives (les icônes actuelles sont un pictogramme provisoire).
- Textes légaux définitifs (pages actuelles marquées « provisoires »).
- Découpage du bundle principal (supabase-js peut être chargé dynamiquement).
