# ADR-0005 — Supprimer sa contribution : annuler après coup, et une corbeille

Statut : accepté · Date : 2026-09-06

## Contexte

Le modèle porte `deletedAt` sur les lieux, les événements et les retours
d'expérience depuis le premier jour. Les lectures le filtrent partout. La base
n'a **aucune politique DELETE**, et c'est écrit noir sur blanc dans
`0001_initial_schema.sql` : « Pas de DELETE : suppression logique ». Tout le
mécanisme de la suppression réversible était donc en place.

Il manquait le geste. **Rien, nulle part, ne posait `deletedAt`** : ni port, ni
écran. Un lieu saisi par erreur, un retour publié sur la mauvaise fiche, un
événement annulé — restaient publiés pour toujours. Et par conséquent, rien ne
le défaisait non plus : une machine à rattraper les erreurs, sans erreur à
rattraper, faute de pouvoir en commettre.

VALEUR.md (V12) mesure la même chose à l'échelle du parc : `ConfirmDialog` du
socle est monté dans 14 applications, `useUndoableState` dans **zéro**, et
family-map est nommément citée parmi celles qui ont « une suppression logique
sans écran de restauration ».

## Décision

Trois pièces, décidées ensemble.

### 1. Le port `deleteOwn` / `restoreOwn`, pas un DELETE

`PlaceRepository`, `EventRepository` et `ReviewRepository` reçoivent deux
méthodes symétriques. Côté local, elles posent ou retirent `deletedAt` ; côté
Supabase, elles font un `update` de `deleted_at`. **Jamais un DELETE** : la
table n'en accepte pas, et c'est ce qui rend tout le reste possible.

L'autorisation est celle d'`updateOwn` — session exigée, auteur seul —, parce
que supprimer _est_ une modification, et que la politique RLS
`places_update_own_or_mod` l'applique déjà telle quelle. **Aucune migration
n'est nécessaire.** De même en lecture : `places_select_public` porte
`or author_id = auth.uid()`, donc l'auteur voit déjà ses lignes supprimées ; la
corbeille n'a besoin d'aucune politique nouvelle. Un chantier qui n'ajoute pas
de surface d'attaque au serveur.

### 2. Annuler après coup, plutôt que confirmer avant

Pas de « Êtes-vous sûr ? ». Une notification « Lieu supprimé · **Annuler** »
pendant **huit secondes**.

Le dialogue de confirmation fait payer à **chaque suppression volontaire** — la
quasi-totalité d'entre elles — le prix des **rares** suppressions par erreur. Et
il ne protège même pas de celles-là : la boîte qui apparaît toujours est celle
qu'on apprend à valider sans lire. Annuler après coup inverse le marché : le
geste courant est gratuit, le geste regretté se rattrape.

Huit secondes, pas cinq (le défaut du socle) : cinq suffisent à **lire** une
notification, pas à réaliser qu'on s'est trompé, à trouver le bouton et à
l'atteindre au pouce. Le socle suspend en plus le compte à rebours tant que le
doigt ou le focus est sur la pile (WCAG 2.2.1) : le délai est un plancher, pas
un couperet.

Le `toast` du socle n'ayant pas d'action, elle est écrite dans l'app
(`src/shared/hooks/useUndoToast.tsx`) en s'appuyant sur ce qu'il accepte déjà :
le message est un `ReactNode`, et une notification peut porter un identifiant
stable — ce qui donne de quoi la refermer depuis l'intérieur, et fait qu'une
seconde suppression **remplace** la première notification au lieu d'empiler deux
« Annuler » indiscernables.

C'est un manque du socle, pas de l'application : un `toast` avec action a sa
place dans `dev-pwa-config`, et V12 le range d'ailleurs en couche socle. Ce
fichier est le brouillon local de cette pièce-là, à remonter.

### 3. **Et** une corbeille — les deux, pas l'un ou l'autre

L'énoncé du chantier laissait le choix entre l'annulation immédiate **ou** une
vue « corbeille ». Nous prenons les deux, parce qu'ils ne couvrent pas le même
moment, et parce que le second est ici presque gratuit :

- l'annulation couvre **la seconde qui suit le geste** — c'est là que se
  rattrape la quasi-totalité des erreurs, et c'est ce qui permet de se passer
  du dialogue de confirmation ;
- la corbeille couvre **tout le reste du temps** : la notification manquée, le
  téléphone rangé dans la poche, l'onglet fermé, le regret du lendemain.

Sans la corbeille, l'annulation à huit secondes _serait_ une suppression
définitive dès la neuvième — définitive du point de vue de l'utilisateur, alors
que la donnée est toujours là, intacte, dans le stockage. La cacher à son
propre auteur reviendrait à la lui faire perdre pour de bon tout en prétendant
la conserver. Le coût de la corbeille se réduit à `includeDeleted` sur les
requêtes et à une section d'écran, puisque `restoreOwn` doit exister de toute
façon pour l'annulation.

La corbeille vit dans « Mes contributions », et **n'apparaît que quand elle
contient quelque chose** : une section vide en permanence apprend à ne plus la
regarder, et c'est le jour où elle compte qu'on ne la verrait pas.

## Conséquences

- **Supprimer puis restaurer un lieu publié le renvoie en file de validation.**
  Le déclencheur `reset_place_status_on_author_update` repasse en `pending`
  toute mise à jour faite par un non-modérateur, `deleted_at` compris. C'est
  une décision du serveur, pas de l'interface. La changer demanderait une
  migration exemptant les écritures qui ne touchent que `deleted_at` — à
  rouvrir le jour où le port Supabase des événements et des retours existera,
  pas avant : aujourd'hui un seul port sur onze est branché, et la question ne
  se pose donc en pratique que pour les lieux.
- L'export des contributions (ADR-0006) emporte **aussi** ce qui est supprimé,
  `deletedAt` compris : c'est encore stocké, c'est encore à l'utilisateur, et
  un export de portabilité qui le cacherait mentirait sur ce qui est conservé.
- **Rien n'efface jamais physiquement une contribution — pas même la
  suppression de compte**, qui retire l'accès et _anonymise_ les contributions
  publiées (`requestAccountDeletion` ; THREAT-MODEL, « suppression auth +
  anonymisation »). La rédaction posée d'abord sur la corbeille — « rien n'est
  effacé tant que vous ne supprimez pas votre compte » — laissait croire le
  contraire ; elle a été corrigée, dans l'écran comme dans la page
  « Mentions », qui énonce désormais les deux effets séparément. Une corbeille
  n'a d'intérêt que si ce qu'elle dit de la conservation est exact.

## Preuve

- `src/shared/hooks/useUndoToast.test.tsx` : l'action existe et c'est un vrai
  bouton (clavier, lecteur d'écran) ; l'appuyer défait **et** referme la
  notification tout de suite, donc on n'annule pas deux fois ; ne rien faire
  **ne** défait pas ; la notification tient encore à 7,9 s ; une seconde
  suppression remplace la première.
- `src/pages/MyContributionsPage.undo.test.tsx`, monté sur le **vrai** backend
  local : supprimer retire la ligne, « Annuler » la ramène, la corbeille
  n'existe pas tant qu'elle est vide puis restaure une fois la notification
  partie, et le lieu supprimé est toujours dans le stockage, horodaté.
- `src/shared/api/local/local-backend.test.ts` : la suppression est bien
  logique (l'enregistrement est toujours là, `deletedAt` posé, le nom intact) ;
  un tiers ne peut supprimer **ni** restaurer la contribution d'autrui ; une
  lecture ordinaire — `getById`, la fiche d'un lieu, l'agenda — ne voit jamais
  le supprimé, et `restoreOwn` l'y remet.
- `e2e/critical.spec.ts` : le parcours complet dans un vrai navigateur —
  supprimer, annuler, retrouver ; puis supprimer, recharger, restaurer depuis
  la corbeille.

## Ce que cet ADR écarte

- **Une corbeille généralisée à toute l'application** (purge automatique,
  rétention datée, restauration par la modération). V12 l'écarte explicitement.
- **Un dialogue de confirmation en plus** de l'annulation : ce serait payer les
  deux prix.
- **La suppression physique** — elle n'est ni possible (aucune politique
  DELETE) ni souhaitée.
