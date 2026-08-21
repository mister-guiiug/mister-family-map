# Publication publique par mirroring sélectif

Modèle à deux dépôts :

| Dépôt                                                                                   | Rôle                                                               | Visibilité |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| `elowner-ax/bac-sable`                                                                  | Développement complet (branches de travail, PR, CI, docs internes) | **Privé**  |
| [`mister-guiiug/mister-family-map`](https://github.com/mister-guiiug/mister-family-map) | Version publiée uniquement                                         | **Public** |

Le workflow [`.github/workflows/mirror.yml`](../.github/workflows/mirror.yml)
publie vers le dépôt public **exclusivement** :

- la branche **`main`** ;
- les tags **`v*`** _atteignables depuis `main`_ (un tag posé sur une branche
  de travail n'est jamais publié) ;
- la **release GitHub** associée à un tag (titre et notes repris de la release
  privée si elle existe — les relire avant de taguer : elles deviennent
  publiques).

Aucune autre branche ne part jamais vers le public. La synchronisation est
**automatique** (chaque push sur `main` ou d'un tag `v*`) et reste possible
**manuellement** (bouton _Run workflow_ — `workflow_dispatch`).

## Deux modes de publication

Choisis par la **variable de dépôt** `MIRROR_MODE` (Settings → Secrets and
variables → Actions → _Variables_), surchargeable ponctuellement via l'input
du lancement manuel :

| Mode              | Contenu publié                                                                                           | Historique public                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `mirror` (défaut) | `main` à l'identique                                                                                     | Historique complet de `main`                                                                                           |
| `snapshot`        | Arbre de `main` (ou du tag) **filtré** par [`.github/mirror-exclude.txt`](../.github/mirror-exclude.txt) | **Aucun historique privé** : un commit public par publication, chaîné au précédent (historique public linéaire propre) |

Choisir `snapshot` si l'historique privé doit être filtré avant publication
(messages de commit internes, fichiers retirés après coup, docs internes).
En mode `snapshot`, les tags publics sont reposés sur le commit d'instantané.

⚠️ Dans les deux modes : un fichier qui ne doit **jamais** être public ne doit
pas être committé sur `main` (le filtre `snapshot` retire des chemins de la
publication, il ne réécrit pas le passé du dépôt privé). Un secret committé
par erreur se traite par rotation du secret + réécriture d'historique privé
AVANT toute publication.

## Mise en place (une fois)

1. **Dépôt public** : `mister-guiiug/mister-family-map` existe déjà. Le
   premier passage du workflow poussera `main` (force) — tout contenu
   d'amorçage (README initial…) sera remplacé.
2. **Jeton** : créer un **PAT fine-grained** (compte ayant l'écriture sur le
   dépôt public) → _Only select repositories_ = `mister-guiiug/mister-family-map`,
   permission **Contents : Read and write** uniquement. Expiration raisonnable
   (12 mois max) et rappel de rotation.
3. **Secret** : dans `bac-sable` → Settings → Secrets and variables → Actions →
   _New repository secret_ : `MIRROR_PUSH_TOKEN` = le PAT. Le jeton n'a aucun
   droit sur le dépôt privé : une fuite ne compromettrait que le miroir public.
4. **Mode** (optionnel) : variable `MIRROR_MODE` = `mirror` ou `snapshot`
   (défaut sans variable : `mirror`).
5. **Branche `main`** : le miroir ne publie que `main` — la créer à partir de
   la branche de squelette si ce n'est pas déjà fait.
6. **Test** : Actions → _Mirror public_ → _Run workflow_ (choisir le mode pour
   un essai), puis vérifier le contenu du dépôt public.

## Côté dépôt public (recommandé)

- Désactiver _Issues_, _Projects_ et _Wiki_ si les échanges doivent rester sur
  le dépôt privé (ou les laisser ouverts pour les retours de la communauté —
  choix produit à faire).
- Protéger `main` contre les pushes directs humains : seule l'automatisation
  doit écrire (le PAT du miroir).
- Ajouter une note au README public indiquant que le développement se fait
  sur un dépôt privé et que les PR externes ne peuvent pas y être fusionnées
  telles quelles.

## Publier une version

```bash
git checkout main && git pull
git tag v0.1.0
git push origin v0.1.0        # → mirroring du tag + release publique
```

(Optionnel : créer d'abord la release **privée** sur le tag pour en soigner
les notes — elles seront reprises pour la release publique.)

## Limites connues

- Les releases privées créées AVANT le premier passage du workflow ne sont pas
  rejouées rétroactivement : relancer le workflow sur chaque tag concerné
  (`git push origin <tag>` re-déclenche, ou _Run workflow_ après avoir poussé
  le tag).
- En mode `mirror`, une réécriture d'historique de `main` privé est propagée
  au public (push `--force`) — c'est voulu (c'est un miroir), mais les clones
  publics existants devront se rebaser.
