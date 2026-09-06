# Modèle de données

Source d'autorité : `supabase/migrations/0001_initial_schema.sql` (colonnes,
types, contraintes, index, RLS). Ce document explique la **finalité** et les
règles transverses ; en cas d'écart, la migration fait foi.

## Règles transverses

- **Identifiants stables** : `uuid` (`gen_random_uuid()` / `crypto.randomUUID()`).
- **Horodatage** : `created_at` / `updated_at` (trigger `touch_updated_at`).
- **Publication** : `status` (`draft → pending → published | hidden | rejected`),
  imposé côté serveur (triggers) — un client ne publie jamais directement.
- **Traçabilité** : `author_id` posé par le serveur (`auth.uid()`),
  `moderation_actions` + `audit_logs` en append-only.
- **Suppression logique** : `deleted_at` sur les contenus collaboratifs
  (places, events, reviews) ; pas de politique DELETE en RLS. C'est un
  `UPDATE`, donc la politique `…_update_own_or_mod` suffit ; et
  `places_select_public` portant `or author_id = auth.uid()`, **l'auteur voit
  déjà ses lignes supprimées** — la corbeille de « Mes contributions » et sa
  restauration n'ont demandé aucune politique nouvelle (ADR-0005).
- **Enfants** : aucune donnée nominative — uniquement des tranches d'âge
  anonymes (`age_brackets` texte, `age_min`/`age_max`).
- **Coordonnées** : contraintes SQL `lat ∈ [-90,90]`, `lng ∈ [-180,180]`,
  doublées par les schémas Zod côté client.

## Tables

| Table                | Finalité                                                          | Accès (résumé RLS)                                                           | Données sensibles                       |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------- |
| `profiles`           | Pseudonyme public lié à `auth.users`                              | SELECT public ; UPDATE propriétaire                                          | e-mail (dans auth.users, jamais exposé) |
| `user_roles`         | Rôle applicatif, séparé du profil pour interdire l'auto-promotion | SELECT soi/modération ; ALL admin                                            | —                                       |
| `categories`         | Catégories configurables (jamais codées en dur)                   | SELECT public ; ALL admin                                                    | —                                       |
| `places`             | Points d'intérêt                                                  | SELECT publié+propres+modération ; INSERT membres ; UPDATE auteur/modération | position du lieu (publique par nature)  |
| `place_features`     | Attributs famille ternaires (oui/non/inconnu)                     | suit `places`                                                                | —                                       |
| `place_photos`       | Métadonnées photos (fichiers en Storage privé)                    | publiées visibles ; INSERT membres                                           | EXIF retiré côté client avant envoi     |
| `place_revisions`    | Propositions de modification sur le lieu d'autrui                 | INSERT membres ; lecture auteur/modération                                   | —                                       |
| `reviews`            | Retours d'expérience structurés (1/membre/lieu/date)              | publiés visibles ; auteur gère les siens                                     | tranches d'âge anonymes                 |
| `review_photos`      | Photos des retours                                                | idem place_photos                                                            | idem                                    |
| `events`             | Événements (dates tz-aware, récurrence JSON simple, statuts)      | comme places (+`cancelled` visible)                                          | —                                       |
| `favorites`          | Favoris personnels                                                | strictement propriétaire                                                     | liste privée de lieux                   |
| `reports`            | Signalements                                                      | INSERT membres ; lecture auteur/modération                                   | —                                       |
| `moderation_actions` | Historique des décisions                                          | modération                                                                   | —                                       |
| `audit_logs`         | Journal d'administration append-only                              | SELECT admin ; écriture par fonctions serveur                                | —                                       |

## Occurrences d'événements

Pas de table `event_occurrences` au MVP : la récurrence simple
(`daily|weekly|monthly` + `until`, JSON) est **dépliée côté domaine**
(`entities/event/agenda.ts#expandOccurrences`, bornée). Si des besoins
d'exceptions par occurrence apparaissent (annuler une seule séance), créer la
table dans une migration dédiée — le contrat du domaine est déjà prêt.

## Stratégie géospatiale

MVP : colonnes `lat`/`lng` contraintes + index composite `(lat, lng)` ; les
requêtes carte passent par un **rectangle englobant** (zone visible), le tri
par distance se fait côté client (haversine, `shared/lib/geo.ts`).

PostGIS est disponible sur Supabase (extension à activer) mais n'est PAS
requise pour la volumétrie visée. Critères de bascule (migration ultérieure) :
recherche par rayon exact en SQL, tri par distance paginé côté serveur, ou
plus de ~50 000 lieux. La bascule ajoute `geography(Point)` + index GiST sans
casser l'API des repositories.
