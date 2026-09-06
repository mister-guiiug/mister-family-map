# ADR-0007 — Synchronisation entre onglets : le message porte la valeur

Statut : accepté · Date : 2026-09-06

## Contexte

`shared/api/tab-sync.ts` met deux onglets d'accord sans serveur : chaque
mutation du backend local annonce son sujet (`favorites`, `session`, …) sur le
port temps réel du socle, transporté par `BroadcastChannel`. L'onglet qui
recevait l'annonce **relisait `localStorage`** pour se mettre à jour.

Ce contrat — « quelque chose a changé, va voir » — repose sur une hypothèse
jamais écrite : que l'écriture de l'onglet émetteur soit visible par l'onglet
receveur au moment où le message y arrive.

**Elle est fausse.** Deux onglets sont deux processus de rendu ; le message
passe par le processus navigateur, la propagation du stockage suit son propre
chemin, et rien n'ordonne les deux.

## Le constat, mesuré

`e2e/critical.spec.ts` (« deux onglets restent d'accord sur les favoris ») est
passé de **8/8** à **8 échecs sur 16** le jour où l'état local est passé sous
une clé unique (ADR-0004).

Une sonde placée **au point d'appel exact** du receveur — pas dans un écouteur
voisin, dont l'ordre d'exécution ne dit rien — a rendu le verdict sans
ambiguïté :

```
SONDE store.load ids= [] | brut AVANT= ABSENT | brut APRES= ABSENT
```

Au moment où l'onglet B traite l'annonce, `mfm_data` n'existe pas encore chez
lui. Il relit, ne trouve rien, et pose une liste vide.

Trois hypothèses ont été écartées **avant** celle-là, chacune par une mesure :

- _le message n'arrive pas_ — non : instrumenter `BroadcastChannel` montre
  qu'il est reçu à **tous** les essais, par le canal vivant ;
- _le magasin versionné du socle met en cache_ — non : `load()` relit
  `getRaw` à chaque appel ;
- _les fournisseurs ajoutés dans `main.tsx` (thème, notifications) sont en
  cause_ — non : le défaut persiste avec le `main.tsx` d'origine.

**Le défaut n'est pas né avec l'ADR-0004 : il était déjà là, invisible.** La
clé diffusée pesait alors vingt octets (`mfm_favorites`) ; sous une clé unique
de ~11 ko, la fenêtre s'est ouverte assez large pour tomber une fois sur deux.
Une mise à jour du socle, une machine plus lente ou un utilisateur avec
beaucoup de contributions l'auraient trouvée tôt ou tard.

## Décision

**Le message porte la valeur ; il ne dit pas « va voir ».**

`TabSyncMessage` devient une union **discriminée** :

```ts
type TabSyncMessage =
  | { topic: 'favorites'; ids: readonly string[] }
  | { topic: 'session'; session: AuthSession | null }
  | { topic: 'places' | 'events' | 'reviews' };
```

L'onglet receveur pose la valeur reçue (`setIds`, `setSession`) et **ne relit
plus rien**. La course n'est pas rétrécie : elle disparaît, puisqu'il n'y a
plus deux sources à mettre d'accord.

Les trois sujets sans auditeur ne portent pas encore de valeur. Le type est ce
qui rend l'oubli impossible : le jour où l'un d'eux gagne un auditeur, il
faudra lui donner sa charge, et le compilateur le rappellera.

## Pourquoi pas les autres remèdes

- **Réduire la taille de l'instantané** (ne pas persister les données de
  démonstration) : rétrécit la fenêtre, ne la ferme pas. Un correctif qui rend
  un défaut plus rare est pire qu'aucun correctif — il le rend introuvable.
- **Réessayer la lecture après un délai** : non déterministe, et il faudrait
  choisir un délai qu'aucune mesure ne justifie.
- **Garder les favoris dans leur propre clé** : abandonne l'ADR-0004 pour une
  collection sur neuf, et laisse la même course sur les huit autres.
- **Passer par l'évènement `storage` plutôt que `BroadcastChannel`** : celui-ci
  serait effectivement ordonné (les écritures d'une même origine s'appliquent
  dans l'ordre, et l'évènement suit l'application). Mais ce serait forcer le
  repli du transport du socle, donc cesser de l'éprouver — alors que ce module
  est aussi son banc d'essai.

## Ce que ça aligne, en plus

Un vrai transport temps réel **livre la donnée** : `postgres_changes` de
Supabase transporte la ligne, il ne demande pas de relire la table. Le contrat
de ce module s'en rapproche au lieu de s'en éloigner — ce qui compte, puisqu'il
est explicitement le banc d'essai du port `realtime/` du socle, et que ce port
a été conçu sans usage réel.

## Portée

Le défaut est **générique**, pas propre à cette application : toute app de la
famille qui annonce un sujet et fait relire le stockage à l'autre onglet a la
même course. À remonter au socle avec cette mesure.

## Preuve

`src/shared/api/tab-sync.test.ts`, section « le message porte la valeur » :
l'ajout et le retrait d'un favori emportent la liste complète (et une liste
vide reste une liste, pas une absence) ; la connexion emporte la session, la
déconnexion emporte `null` ; et surtout — **le stockage est effacé entre
l'annonce et son traitement**, et le receveur repart quand même avec la bonne
valeur. C'est la reproduction fidèle de ce que faisait le navigateur.

En bout de chaîne, l'E2E multi-onglets est passé de 8 échecs sur 16 à **10
succès sur 10**.
