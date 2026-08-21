# AUDIT DE COMPATIBILITÉ DEV-WPA-CONFIG

Audit réalisé le 2026-08-21 sur l'état du dépôt `mister-guiiug/dev-wpa-config`
(source de vérité : `package.json` + exports réellement présents).

## Version du paquet partagé

`@mister-guiiug/dev-wpa-config` **3.10.1** (npm.pkg.github.com, scope
`@mister-guiiug`). Dépendance déclarée : `^3.10.1`.

## Exports réellement disponibles (tous vérifiés présents)

Configs : `eslint-base`, `eslint-react`, `prettier`, `commitlint`,
`lint-staged`, `tsconfig-app`, `tsconfig-app-react`, `tsconfig-node`,
`tsconfig-strict-plus`, `vitest-base`, `vitest-setup`, `vitest-browser-base`,
`playwright-base`, `playwright-a11y`, `vite-pwa-base`, `vite-csp`,
`tailwind-preset`, `tailwind-preset.css`, `components.css`, `apps-catalog`,
`react` (+ sous-chemins `use-update-prompt`, `update-prompt-banner`, `rive`,
`i18n`, `observability`) ; bin `pwa-icons`.

Tous les fichiers demandés dans la commande existent, avec deux précisions :

- « prettier-base.js ou l'export Prettier » → export **`/prettier`**
  (fichier `prettier-base.js`) ;
- `vitest-browser-base.js`, `playwright-base.js`, `tailwind-preset.js/.css`
  existent bel et bien.

## Versions imposées / attendues (peerDependencies 3.10.1)

Node ≥ 22 · TypeScript **~6.0.3** · ESLint **^9.39.4** (+ @eslint/js,
typescript-eslint ^8.58, react-hooks ^7, react-refresh ^0.5, jsx-a11y ^6.10,
globals ^17.4) · Prettier ^3.6.2 · Vite **^8** (Rolldown) · Vitest **^4** ·
React ^19 · Tailwind **^4** (`@tailwindcss/vite`) · Zod **^4** ·
@playwright/test ^1.49 · lucide-react ^1 · sharp ≥ 0.33.

Points de vigilance vérifiés sur le registre npm : TypeScript est en 7.x et
ESLint en 10.x en « latest » — le projet **respecte les ranges famille**
(`typescript@~6.0.3`, `eslint@^9.39.4`) et n'utilise aucun « latest ».

## Configurations héritées par mister-family-map

- `eslint.config.js` → ré-export `/eslint-react` ; `prettier.config.js` →
  `/prettier` ; `commitlint.config.js`, `lint-staged.config.js` idem.
- `tsconfig.app.json` → extends `/tsconfig-app-react` ; `tsconfig.node.json`
  → `/tsconfig-node` (aucun override de strictness).
- `vitest.config.ts` → `baseTestOptions` + `coveragePreset` ;
  `src/test/setup.ts` → `/vitest-setup`.
- `playwright.config.ts` → `definePwaPlaywrightConfig({ devices })`.
- `vite.config.ts` → `pwaSeoPlugin()` + `cspPlugin()` (ordre documenté
  respecté : CSP après SEO).
- `src/shared/styles/index.css` → `tailwind-preset.css` et `components.css`,
  plus le contrat `--dwc-*` (13 variables).
- `index.html`, `.npmrc`, `.nvmrc`, `.editorconfig`, `.lighthouserc.json`,
  `.vscode/{extensions,settings}.json` copiés depuis `templates/`.
- Composants/hooks `/react` consommés : Button, TextField/SelectField/
  TextAreaField, Badge, Sheet, Skeleton(Group), EmptyState, ErrorBanner,
  ErrorBoundary, useOnline, UpdatePromptBanner.

## Overrides nécessaires

- `vitest.config.ts` : `provider: 'v8'` redéclaré à côté du spread de
  `coveragePreset` — le preset est du JS non typé (`provider: string`) et
  Vitest 4 exige le littéral. Seul override requis.
- Aucun override tsconfig ni ESLint.

## Workflows / actions réutilisables retenus

- `ci.yml` → **`pwa-ci.yml@v3`** (`secrets: inherit`, permissions caller
  `contents: read` + `packages: read`, `run-e2e: true` grep `@critical`,
  `run-npm-audit: true`).
- `deploy.yml` → **`pwa-deploy.yml@v3`** (`pages/id-token: write` au caller ;
  **pas** de `concurrency: pages` côté caller — interblocage documenté).
- `lighthouse.yml` → **`pwa-lighthouse.yml@v3`** + `.lighthouserc.json`.
- Composite `setup-pwa@v3` utilisée via les reusables (auth GitHub Packages
  par `NODE_AUTH_TOKEN` = `secrets.GITHUB_TOKEN`).
- Prévu à l'activation de Supabase : `supabase-migrate@v3` +
  `pwa-supabase-keepalive.yml` (templates keep-alive).

## Écarts documentation / réalité constatés

- README (« Stack cible juin 2026 ») : `eslint-plugin-react-refresh ^0.5.2` et
  `globals ^17.4.0` en peers, cohérents ; RAS entre README et `package.json`
  au niveau des exports. Seule nuance : le README montre `src/test/setup.ts`
  avec `@testing-library/jest-dom/vitest` dans un premier exemple puis
  recommande `/vitest-setup` (qui inclut jest-dom + mocks PWA) — le projet
  suit la recommandation `/vitest-setup`.

## Incompatibilités détectées

1. **Accès GitHub Packages absent dans l'environnement de génération** : le
   registre exige une authentification même pour les paquets publics et le
   jeton de session (app installation) est refusé (401). Conséquence : le
   `package-lock.json` livré est complet et cohérent pour tout npmjs, mais
   l'entrée `@mister-guiiug/dev-wpa-config` est **sans `resolved` ni
   `integrity`** (npm les complètera au premier `npm install` authentifié —
   `npm ci` fonctionne en l'état). Le caller CI passe `verify-lockfile: false`
   avec un TODO : régénérer le lock authentifié, committer, repasser à `true`.
2. `pwa-deploy.yml` publie sur **GitHub Pages** du dépôt appelant : OK pour
   `bac-sable`, mais l'URL sera `<owner>.github.io/bac-sable/` (base path
   auto). Rien à faire, simple à savoir.
3. `FUNDING.yml` / `FamilyApps` / `apps-catalog` : non appliqués — `bac-sable`
   (org `elowner-ax`) n'appartient pas au catalogue famille `mister-guiiug` ;
   les liens sponsor famille n'y auraient pas de sens. À réactiver si le
   projet migre dans l'org famille.

## Décisions techniques HORS dépôt partagé (→ propositions à valider)

| Décision                                                  | Justification                                                                                            | Où                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------- |
| Leaflet 1.9 + tuiles OSM derrière un port `MapProvider`   | cf. ADR                                                                                                  | docs/adr/0001         |
| Supabase (schéma + RLS livrés) avec démarrage local-first | cf. ADR                                                                                                  | docs/adr/0002         |
| Export ICS sans dépendance                                | cf. ADR                                                                                                  | docs/adr/0003         |
| react-router ^8, zustand ^5                               | routage SPA et état léger ; versions relevées sur npm le 2026-08-21                                      | package.json          |
| App à la RACINE du dépôt bac-sable                        | les reusable workflows famille opèrent à la racine (npm ci sans working-directory) ; le dépôt était vide | —                     |
| Clustering par grille maison                              | évite une dépendance ; testé unitairement                                                                | shared/lib/cluster.ts |
| husky/commitlint non installés (configs livrées)          | hooks git = choix d'équipe ; templates famille prêts à copier                                            | README « Hooks git »  |
