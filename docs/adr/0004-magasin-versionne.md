# ADR-0004 — L'état local sous une clé versionnée, migrée depuis les neuf clés d'hier

Statut : accepté · Date : 2026-09-06

## Contexte

Le backend local n'est pas un mode de démonstration : c'est le mode par défaut,
et il le restera tant que les dix ports encore non branchés côté Supabase ne le
seront pas. En mode `supabase`, **un seul port sur onze** a un adaptateur
(`PlaceRepository`) ; tout le reste — événements, retours d'expérience,
favoris, session, signalements, décisions de modération, propositions de
correction — vit dans le navigateur de l'utilisateur, et nulle part ailleurs.
Ce ne sont pas des préférences d'affichage : ce sont **les contributions qu'il
a saisies**.

Jusqu'à cet ADR, cet état était écrit en neuf clés indépendantes du magasin du
socle (`createStore('mfm_')`) :

```
mfm_places  mfm_events  mfm_reviews  mfm_categories  mfm_favorites
mfm_session  mfm_reports  mfm_moderation_actions  mfm_place_revisions
```

Chacune un tableau **nu** : pas de numéro de version, pas de validation à la
lecture, pas de migration. Tant que le modèle ne bouge pas, rien ne se voit.
Le jour où il bouge — un champ ajouté, un statut renommé, une forme
d'enregistrement changée —, l'app lit une donnée qu'elle ne comprend plus, la
traite comme si elle la comprenait, et la réécrit par-dessus. La perte est
silencieuse, totale et simultanée chez tout le monde.

VALEUR.md range family-map parmi les six applications du parc « sans schéma ni
migration » (V10). Le socle, lui, est prêt depuis longtemps :
`createVersionedStore` tient l'enveloppe, la chaîne de migrations et la copie
de côté.

## Décision

Tout l'état local passe sous **une seule clé, `mfm_data`, enveloppée d'un
numéro de version** par `createVersionedStore` du socle
(`src/shared/api/local/snapshot.ts`). `local-backend.ts` ne connaît plus que
`readSnapshot()` et `writeSnapshot({ … })`.

La migration `0 → 1` **relit les neuf clés d'aujourd'hui**. Elle ne peut pas
être déduite : c'est la seule chose que le socle ne peut pas savoir. Elle se
fait en deux temps, et l'ordre compte :

1. `primeFromLegacy()` rassemble les neuf clés existantes et les pose sous
   `mfm_data` **sans enveloppe** ;
2. le magasin lit donc une donnée « en version 0 », ce qui déclenche sa
   séquence : copie de côté sous `mfm_data.backup-v0`, **puis** migration,
   **puis** validation.

## Trois choix, et leur raison

### 1. Les clés d'hier ne sont pas effacées

Elles deviennent inertes. Un retour arrière du déploiement — ou simplement un
onglet resté ouvert sur l'ancienne version — retrouve alors l'app dans l'état
exact d'avant la migration, au lieu d'un stockage vide. Le coût est quelques
kilo-octets dormants ; le bénéfice est qu'une migration ratée reste
rattrapable.

Corollaire obligatoire : `primeFromLegacy` est **idempotent**. Dès que
`mfm_data` existe, les clés d'hier ne sont plus regardées. Sans cette garde, un
onglet ancien réécrirait `mfm_places` et la migration se rejouerait par-dessus
le travail de l'utilisateur.

### 2. La validation est lâche : la forme, pas le contenu

`parseSnapshot` vérifie que l'objet est un instantané de **cette** app et que
ses collections sont des tableaux. Il ne passe pas chaque enregistrement au
schéma zod correspondant.

C'est délibéré. Un `placeSchema.parse` sur tout le tableau échangerait « un
lieu mal formé » contre « toutes les données de l'utilisateur dans un fichier
de secours qu'il ne sait pas atteindre » : le remède serait pire que le mal.
Les **écritures**, elles, restent validées à la saisie par zod — c'est là que
la validation empêche la donnée invalide d'entrer, et c'est le bon endroit.

Ce que la validation attrape quand même, et qui compte : un `mfm_data` qui
n'est pas un objet, ou qui ne porte aucun champ connu. C'est la garde qui
protégera un futur `import()` d'un fichier étranger.

### 3. Écriture par lecture-modification-écriture de l'instantané entier

`writeSnapshot({ places })` relit tout, fusionne, réécrit tout. C'est
exactement ce que faisait déjà chaque mutation clé par clé
(`store.set(KEYS.places, [...places, place])`), et `localStorage` étant
synchrone, la fenêtre entre lecture et écriture reste celle d'une instruction.

## Conséquences

- Les données de démonstration ne sont plus posées collection par collection à
  la première lecture : le magasin les rend comme **état initial**, et rien
  n'est écrit tant que l'utilisateur n'a rien fait. Une installation neuve
  laisse donc `localStorage` vide, ce qui est plus honnête.
- `mfm_place_wizard_draft` (l'assistant de saisie en cours) **reste hors de
  l'instantané** : c'est un état d'interface, pas une contribution ; il a sa
  propre durée de vie et son propre effacement. `snapshot.test.ts` le fige.
- Toute évolution ultérieure du modèle **ajoute** une migration, elle n'en
  retire jamais : `migrations: { 0: …, 1: …, … }`, une par version source.

## Preuve

`src/shared/api/local/snapshot.test.ts` écrit un **instantané des neuf clés
réelles** — nommément, avec des enregistrements complets — puis vérifie qu'après
migration tout est retrouvé, que la copie de côté existe, que les clés d'hier
sont intactes, que rejouer la migration n'écrase rien, et qu'une donnée venue
d'une version future est mise de côté plutôt que jetée.

## Ce que cet ADR écarte

IndexedDB. Le volume tient très largement dans `localStorage`, et le problème
posé ici n'est pas la capacité : c'est l'absence de version. Changer de moteur
de stockage en même temps que d'enveloppe aurait mélangé deux décisions dont
une seule est motivée par un défaut mesuré.
