# ADR-0002 — Backend : Supabase, consommé derrière des ports, démarrage local-first

Statut : accepté · Date : 2026-08-21

## Contexte

Le cahier des charges impose des comptes, des rôles, de la modération, du
stockage de photos et une autorité serveur (aucune confiance dans le client).
La stack famille (dev-wpa-config) documente déjà Supabase comme backend de
référence (miss-carbook, mister-doc, mister-footcoach, miss-supaboss…) avec
outillage partagé (composite action `supabase-migrate@v3`, keep-alive Free).

## Comparaison factuelle

| Critère                                               | Supabase                                      | Firebase                              | Backend Node custom       |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------- | ------------------------- |
| Autorisation serveur                                  | RLS SQL déclarative, testable                 | Security Rules (langage propriétaire) | à écrire soi-même         |
| Modèle relationnel (lieux↔avis↔événements↔modération) | Postgres natif                                | NoSQL : dénormalisation et fan-out    | libre mais coûteux        |
| Géospatial                                            | B-tree lat/lng aujourd'hui, PostGIS activable | géohash manuels                       | libre                     |
| Migrations versionnées                                | SQL, CLI, action famille existante            | limité                                | libre                     |
| Coût MVP                                              | Free (avec keep-alive famille)                | Free                                  | hébergement + maintenance |
| Expérience famille                                    | 6 apps en production                          | 3 apps                                | aucune                    |

Aucun avantage décisif pour une alternative → **Supabase**, conformément à la
règle énoncée dans la demande.

## Décision

1. Tout accès aux données passe par les **ports** de `shared/api/ports.ts` ;
   les composants ne connaissent aucun SDK.
2. Le squelette démarre en **local-first** (`shared/api/local`) : app
   utilisable sans projet Supabase (démo, tests, E2E, hors ligne) — même
   approche que miss-lookhouse.
3. Le schéma + RLS complets sont livrés (`supabase/migrations/0001…`), avec un
   adaptateur Supabase de **référence** (`PlaceRepository`) montrant le patron
   (mapping ligne → schéma Zod, zéro décision d'autorisation côté client).
4. La bascule est pilotée par l'environnement (`VITE_SUPABASE_URL` +
   `VITE_SUPABASE_ANON_KEY`, ou `VITE_BACKEND=supabase`), port par port —
   feuille de route dans `supabase/README.md`.

## Conséquences

- Les parcours critiques sont testables sans réseau ni secrets (CI incluse).
- Le travail restant est borné et mécanique : décliner les adaptateurs sur le
  patron de référence, puis brancher Supabase Auth (magic link) à la place de
  la session de démonstration locale.
- Risque assumé : divergence temporaire entre règles du backend local (démo)
  et RLS — les tests d'intégration des ports limitent ce risque en fixant le
  comportement contractuel (statuts imposés, propriété des contenus).
