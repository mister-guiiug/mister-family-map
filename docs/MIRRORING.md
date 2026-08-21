# Publication publique par mirroring sélectif — à coût zéro

Modèle à deux dépôts :

| Dépôt                                                                                   | Rôle                                                           | Visibilité |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------- |
| `elowner-ax/bac-sable`                                                                  | Développement complet (branches de travail, PR, docs internes) | **Privé**  |
| [`mister-guiiug/mister-family-map`](https://github.com/mister-guiiug/mister-family-map) | Version publiée + CI + déploiement Pages                       | **Public** |

## Principe économique

Les minutes GitHub Actions ne sont pas disponibles sur le dépôt privé, et il
n'est pas prévu d'en acheter. Le dispositif s'appuie donc sur deux faits :

1. **Actions est gratuit et illimité sur les dépôts publics** → toute
   l'automatisation lourde (CI complète, E2E, Lighthouse, déploiement GitHub
   Pages) s'exécute sur le **miroir public**, après chaque publication.
2. **La publication s'exécute sur le poste de travail** (`npm run mirror`) →
   aucune minute Actions, aucun secret à configurer : le push utilise vos
   identifiants git habituels (vous avez l'écriture sur le dépôt public).

Les workflows `ci.yml`, `deploy.yml` et `lighthouse.yml` restent versionnés
ici mais portent une garde `if: github.repository ==
'mister-guiiug/mister-family-map'` : sur le dépôt privé, leurs jobs sont
`skipped` (aucun runner demandé → **0 minute consommée, 0 échec affiché**) ;
sur le dépôt public, ils tournent normalement. La qualité côté privé est
garantie par `npm run verify`, que le script de publication exige avant tout
push.

## Publier

```bash
# Publication courante (main, historique complet) :
npm run mirror

# Publication d'une version (main + tag, atteignable depuis main uniquement) :
git tag v0.1.0 && git push origin v0.1.0
npm run mirror -- --tag v0.1.0

# Historique FILTRÉ (aucun commit privé publié — cf. mode snapshot) :
npm run mirror:snapshot

# Répétition à blanc / options :
npm run mirror -- --dry-run
npm run mirror -- --remote git@github.com:mister-guiiug/mister-family-map.git
```

Le script (`scripts/mirror.mjs`, Node ≥ 22, zéro dépendance) :

- refuse un arbre de travail sale, un `main` en retard sur `origin/main`, un
  tag non `v*` ou non atteignable depuis `main` ;
- exécute **`npm run verify`** (format · lint · types · tests · build) avant
  tout push — c'est le portail qualité qui remplace la CI privée
  (`--skip-verify` existe mais est déconseillé) ;
- ne pousse **que** `main` (et le tag demandé), jamais une autre branche.

Chaque publication sur le `main` public déclenche gratuitement, côté public :
la CI complète (dont E2E `@critical`), Lighthouse, et le déploiement Pages →
<https://mister-guiiug.github.io/mister-family-map/>.

## Deux modes de publication

| Mode              | Commande                  | Contenu publié                                                                                           | Historique public                                                                  |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `mirror` (défaut) | `npm run mirror`          | `main` à l'identique                                                                                     | Historique complet de `main`                                                       |
| `snapshot`        | `npm run mirror:snapshot` | Arbre de `main` (ou du tag) **filtré** par [`.github/mirror-exclude.txt`](../.github/mirror-exclude.txt) | **Aucun historique privé** : un commit public par publication, chaîné au précédent |

Choisir `snapshot` si l'historique privé doit être filtré avant publication
(messages de commit internes, docs internes). En mode `snapshot`, les tags
publics sont reposés sur le commit d'instantané. Ne pas exclure les workflows
CI/deploy/lighthouse du filtre : c'est eux qui font tourner l'automatisation
gratuite côté public.

⚠️ Dans les deux modes : un fichier qui ne doit **jamais** être public ne doit
pas être committé sur `main` (le filtre retire des chemins de la publication,
il ne réécrit pas le passé du dépôt privé). Un secret committé par erreur se
traite par rotation du secret + réécriture d'historique privé AVANT toute
publication.

## Releases publiques

Après `npm run mirror -- --tag vX.Y.Z`, créer la release publique (facultatif,
avec [gh](https://cli.github.com)) :

```bash
gh release create vX.Y.Z --repo mister-guiiug/mister-family-map --generate-notes
```

## Mise en place (une fois)

1. **Écriture sur le dépôt public** : vos identifiants git doivent pouvoir
   pousser sur `mister-guiiug/mister-family-map` (HTTPS + credential manager,
   ou SSH via `--remote git@github.com:…`). Aucun PAT dédié ni secret GitHub
   n'est nécessaire.
2. **Pages** : sur le dépôt public, Settings → Pages → Source = « GitHub
   Actions » (une fois, avant le premier deploy).
3. **Optionnel — zéro bruit absolu côté privé** : les gardes rendent déjà les
   runs privés inoffensifs (jobs `skipped`, 0 minute) ; pour ne plus voir ces
   runs du tout, Settings → Actions → General → « Disable actions » sur
   `bac-sable`.
4. **Premier passage** : `npm run mirror` remplacera tout contenu d'amorçage
   du dépôt public (README initial…).

## Côté dépôt public (recommandé)

- Protéger `main` contre les pushes directs d'autres comptes ; désactiver ou
  non Issues/Wiki selon la politique d'échanges retenue.
- Ajouter une note au README public indiquant que le développement se fait sur
  un dépôt privé et que les PR externes ne peuvent pas y être fusionnées
  telles quelles.

## Limites connues

- La synchronisation est **manuelle par conception** (c'est ce qui la rend
  gratuite) : penser à `npm run mirror` après un merge sur `main`. Un oubli ne
  casse rien — le public est simplement en retard.
- En mode `mirror`, une réécriture d'historique du `main` privé est propagée
  au public (push `--force`) — comportement de miroir assumé ; les clones
  publics existants devront se rebaser.
- La CI publique valide le commit **publié** ; en mode `snapshot`, c'est bien
  l'arbre filtré qui est testé (mêmes sources applicatives).
- Passer de `mirror` à `snapshot` ne retire pas l'historique déjà publié : le
  premier snapshot se chaîne sur le `main` public existant. Pour un historique
  public vierge, vider d'abord le dépôt public (ou recréer sa branche `main`).
