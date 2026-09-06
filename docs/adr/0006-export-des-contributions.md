# ADR-0006 — Export des contributions : lire par les ports, tout emporter, un format à part

Statut : accepté · Date : 2026-09-06

## Contexte

`LegalPage.tsx`, au chapitre Confidentialité, dit à l'utilisateur :

> Compte : adresse e-mail et pseudonyme uniquement. Vous pouvez supprimer votre
> compte et exporter vos contributions depuis le profil.

La suppression de compte existait (`requestAccountDeletion`). **L'export
n'existait nulle part** — ni dans `ProfilePage`, ni dans `MyContributionsPage`.
Le seul export de l'application était le `.ics` d'un événement (ADR-0003), qui
n'a rien à voir. Une page qui énonce un droit sans l'outiller ne vaut pas mieux
qu'une page qui n'en parle pas : elle est fausse, et c'est la page qui engage.

VALEUR.md (V17) le compte parmi les cas où « une page promet une fonction
absente ».

## Décision

Un bouton « Exporter mes contributions » dans le Profil, à côté de la
suppression de compte, qui télécharge un fichier JSON unique
(`mister-family-map-contributions-AAAA-MM-JJ.json`) contenant les lieux, les
événements, les retours d'expérience et les favoris de l'utilisateur.

La décision du **contenu** est une fonction pure (`buildContributionsExport`) ;
la **collecte** est séparée (`collectContributions`) ; le **geste** l'est aussi
(`ExportContributionsButton`). Ce qui décide de ce que l'utilisateur reçoit est
donc éprouvable sans navigateur, sans stockage et sans réseau.

### 1. Lire par les ports, jamais par le stockage

L'export interroge `backend.places`, `backend.events`, `backend.reviews`,
`backend.favorites` — les mêmes dépôts que les écrans.

L'alternative évidente — lire `mfm_data` directement, une ligne — a un défaut
qui ne se voit pas aujourd'hui : le jour où les dix ports restants passeront à
Supabase, un export qui lirait `localStorage` rendrait un fichier **vide**,
sans erreur, à un utilisateur convaincu de détenir ses données. Le pire des
échecs pour une fonction de portabilité est celui qui réussit en apparence.

### 2. Filtrer par auteur **deux** fois

Les dépôts filtrent déjà par `authorId`. `buildContributionsExport` refiltre
après coup.

Ce n'est pas de la redondance décorative : c'est la garde contre un adaptateur
qui ignorerait `authorId` — une requête mal formée, une politique RLS trop
large (le parc en a déjà vu : « les politiques permissives se combinent par
OU »). Le défaut serait alors de faire partir **les contributions d'autrui**
dans le fichier d'un utilisateur. Une fuite, pas un bogue d'affichage. Un test
la fige nommément.

### 3. Ce qui est supprimé est **dedans**

Une contribution supprimée est supprimée **logiquement** (ADR-0005) : elle est
toujours stockée, elle est toujours à l'utilisateur, et elle est restaurable
depuis la corbeille. Un export de portabilité qui la cacherait mentirait sur ce
que l'application conserve. Chaque enregistrement emporte donc son `deletedAt`,
qui dit son état plutôt que de le taire.

### 4. Les favoris sont **résolus**

Une liste d'identifiants (`["seed-tete-dor", …]`) ne dit rien à un humain qui
ouvre le fichier. Chaque favori emporte le **nom** du lieu quand il est
lisible, et l'identifiant seul (`name: null`) quand il ne l'est plus — lieu
supprimé par la modération, par exemple — plutôt que de le passer sous silence.
Un favori illisible ne fait jamais échouer l'export entier.

### 5. Le numéro de format est **indépendant** de la version du stockage

`format: 1` dans le fichier n'est pas `SNAPSHOT_VERSION` de l'ADR-0004. Les
deux évoluent pour des raisons différentes : le stockage change quand le modèle
interne change, le fichier change quand ce qu'on promet à l'utilisateur change.
Les confondre obligerait à publier un nouveau format à chaque refonte interne
invisible.

### 6. Un échec est **dit**

Le stockage qui refuse, le navigateur qui bloque le téléchargement, le réseau
qui tombe : chacun produit une notification d'erreur explicite. Un export qui
échoue en silence est pire que pas d'export — l'utilisateur croit détenir ses
données.

## Conséquences

- Le fichier n'est **pas réimportable** à ce jour. C'est assumé : la promesse
  de la page « Mentions » est la portabilité (emporter ses données), pas la
  restauration. `createVersionedStore` fournit déjà `import()` avec validation
  si le besoin apparaît ; ce serait un autre chantier, avec sa propre question
  — que faire des identifiants qui existent déjà.
- Les photos ne sont pas emportées : à ce jour l'application ne stocke que des
  identifiants de photos (`photoIds`), le stockage d'images Supabase n'étant
  pas branché.
- L'export suivra automatiquement les ports au fur et à mesure de leur passage
  à Supabase, sans modification — c'est tout l'objet de la décision 1.

## Preuve

`src/features/contributions/export.test.ts`, joué à travers le **vrai** backend
local et non un double — le bogue qu'un double ne trouve jamais est le filtre
par auteur oublié dans une requête : le fichier emporte bien les lieux, retours
et favoris de l'utilisateur ; il n'emporte **jamais** ceux d'un autre compte ni
ceux du jeu de démonstration ; le second filtre attrape un enregistrement
étranger injecté après les dépôts ; une contribution supprimée est présente et
porte son `deletedAt` ; un favori dont le lieu n'est plus lisible sort avec
`name: null` ; le fichier se relit en JSON et son nom porte la date **locale**
(un export lancé à 23 h 30 ne porte pas la date du lendemain).

`e2e/critical.spec.ts` complète par ce qu'aucun test unitaire ne peut dire :
qu'un fichier sort réellement du navigateur quand on appuie sur le bouton, sous
le bon nom, et qu'il contient bien la contribution qui vient d'être saisie.
