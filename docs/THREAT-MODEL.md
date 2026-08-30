# Modèle de menaces — mister-family-map

Méthode : **STRIDE** par surface, avec pour chaque menace retenue :
impact → mitigation en place → reste à faire. Public visé : familles ;
contexte aggravant : présence indirecte d'enfants → tolérance zéro sur les
données les concernant.

Actifs protégés : comptes (e-mail), contributions et leur intégrité, photos,
position des utilisateurs, journal de modération, disponibilité du service.

## 1. Comptes et authentification

| Menace (STRIDE)  | Scénario                                         | Mitigations                                                                                                                                                       | Reste à faire                                    |
| ---------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Spoofing         | Usurpation de compte via lien magique intercepté | Supabase Auth (magic link, expiration courte), sessions gérées par le SDK                                                                                         | Activer la confirmation d'appareil si disponible |
| Elevation        | Un membre s'auto-promeut modérateur              | Rôles dans `user_roles`, éditable uniquement par l'admin (RLS) ; `is_moderator()` SECURITY DEFINER ; **aucune confiance dans le rôle transmis par le navigateur** | —                                                |
| Info. disclosure | Fuite d'e-mails                                  | E-mail confiné à `auth.users`, jamais exposé par l'API ; profils = pseudonyme seul                                                                                | —                                                |
| Repudiation      | « Ce n'est pas moi qui ai publié ça »            | `author_id` posé par le serveur, horodatages, audit_logs                                                                                                          | —                                                |

Droits des personnes : suppression de compte (`AuthService.requestAccountDeletion`,
à brancher sur une fonction serveur : suppression auth + anonymisation des
contributions publiées) et export des contributions (contrat prévu — endpoint à
écrire). Conservation : compte supprimé → purge sous 30 j ; signalements et
journal de modération conservés 12 mois (base légale : intérêt légitime).

## 2. Contributions (lieux, événements, retours)

| Menace           | Scénario                                 | Mitigations                                                                                                                                             | Reste à faire                                                                                   |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tampering        | Modification du contenu d'autrui         | RLS UPDATE limitée à l'auteur ; les modifications d'autrui passent par `place_revisions` examinées en modération                                        | —                                                                                               |
| Tampering        | Auto-publication sans validation         | Trigger serveur force `status='pending'` à l'insert et après modification par l'auteur                                                                  | —                                                                                               |
| Spoofing (XSS)   | HTML/JS dans un champ texte              | React échappe tout ; aucun `dangerouslySetInnerHTML` ; assainissement client (contrôles, bidi) ; contraintes de longueur SQL ; CSP par hash (cspPlugin) | Test E2E d'injection                                                                            |
| DoS / spam       | Création massive                         | Limiteur client (confort), contrainte d'unicité des reviews, statut `pending` (le spam ne sort pas public)                                              | Rate limiting serveur (API settings / Edge Function) — **prioritaire avant ouverture publique** |
| Info. disclosure | Données personnelles dans un texte libre | Règles de contribution affichées + motif de signalement dédié `privacy` traité en priorité                                                              | Détection automatisée simple (regex tel/e-mail) en aide à la modération                         |

## 3. Images

| Menace           | Scénario                          | Mitigations                                                                                                                     | Reste à faire                                                                                                             |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Info. disclosure | EXIF/GPS révèle domicile ou école | Ré-encodage canvas côté client (`stripImageMetadata` de `@mister-guiiug/dev-wpa-config/image`) : EXIF supprimé par construction | Câbler l'appel au téléversement — aucune photo n'est encore envoyée ; vérification serveur (re-encodage) en fonction Edge |
| Spoofing         | SVG piégé, polyglotte             | Types acceptés JPEG/PNG/WebP uniquement, taille ≤ 5 Mo, vérifiés client ET par les règles du bucket                             | Vérification du magic number côté serveur                                                                                 |
| Info. disclosure | Visages d'enfants                 | Consigne explicite dans le parcours + signalement `privacy` + modération a priori des photos (`status='pending'`)               | —                                                                                                                         |

## 4. Géolocalisation

| Menace           | Scénario                                             | Mitigations                                                                                                                                             | Reste à faire                                          |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Info. disclosure | Position de l'utilisateur collectée                  | Géolocalisation uniquement sur action explicite (« Autour de moi ») ; jamais persistée, jamais envoyée au backend ; l'app fonctionne intégralement sans | —                                                      |
| Info. disclosure | La position d'un « lieu » est en réalité un domicile | Détection de doublons + modération a priori ; motif de signalement `privacy`                                                                            | Heuristique zone résidentielle en aide à la modération |

## 5. Modération

| Menace      | Scénario                    | Mitigations                                                                                     | Reste à faire                                   |
| ----------- | --------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Elevation   | Faux modérateur côté client | Le client ne fait que masquer l'UI ; chaque décision est re-vérifiée par RLS (`is_moderator()`) | —                                               |
| Repudiation | Décision contestée          | `moderation_actions` : qui, quoi, quand, pourquoi — append-only                                 | —                                               |
| DoS         | Vague de faux signalements  | File par statut, décision `dismiss-report` peu coûteuse                                         | Limite de signalements/membre/jour côté serveur |

## 6. API et stockage

| Menace           | Scénario                                  | Mitigations                                                                                                                                                        | Reste à faire                                  |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Tampering        | Requêtes directes à l'API REST (hors app) | La sécurité ne dépend PAS du client : RLS par table et par opération, triggers de défauts, contraintes SQL                                                         | Revue RLS croisée avant production             |
| Info. disclosure | Clé anon dans le bundle                   | Par conception publique ; ne donne que ce que la RLS autorise ; `service_role` jamais côté client/CI de build                                                      | —                                              |
| Info. disclosure | Cache PWA de données personnelles         | Aucun runtime-cache HTTP sur `*.supabase.co` ; favoris/hors-ligne via stockage applicatif explicite ; nettoyage des caches versionnés (`cleanupOutdatedCaches`)    | —                                              |
| Tampering        | Compromission de la chaîne CI             | Permissions Actions minimales (`contents: read`, `packages: read` ; `pages/id-token: write` sur le seul deploy), secrets GitHub, reusable workflows épinglés `@v3` | Épingler par SHA si le niveau d'exigence monte |

## 7. Fournisseur cartographique

| Menace           | Scénario                                                               | Mitigations                                                                                                                                       | Reste à faire                                                                               |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Info. disclosure | Les requêtes de tuiles révèlent les zones consultées à un tiers (OSMF) | Fournisseur à but non lucratif, politique publique ; pas d'identifiant utilisateur dans les requêtes ; CSP restreint `img-src` aux hôtes déclarés | Option auto-hébergement de tuiles si le projet grossit                                      |
| DoS              | Dépassement de la politique d'usage des tuiles OSM                     | Cache borné (200 tuiles/7 j), pas de préchargement massif                                                                                         | Surveiller le volume ; basculer vers un fournisseur commercial si nécessaire (cf. ADR-0001) |

## 8. Agenda et partage de liens

| Menace           | Scénario                                          | Mitigations                                                                                                                    | Reste à faire |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Spoofing         | Faux événement (hameçonnage vers un site externe) | URLs limitées à http(s) (Zod + contrainte SQL), mention « lien fourni par la communauté », statut `proposed` avant publication | —             |
| Tampering        | Lien de fiche partagé vers un contenu retiré      | Page « introuvable » propre (pas d'erreur brute), ids UUID non énumérables                                                     | —             |
| Info. disclosure | Export ICS embarquant des données privées         | L'export ne contient que des champs publics de l'événement                                                                     | —             |

## CSP (récapitulatif)

Prod (via `cspPlugin`, hash SHA-256 des scripts inline) : `default-src 'self'` ;
`connect-src` : self + `tile.openstreetmap.org` + `*.supabase.co` (+wss) +
`nominatim.openstreetmap.org` — MapLibre charge les tuiles par `fetch`, elles
relèvent donc de `connect-src` et non de `img-src` ;
`img-src` : self + data/blob + `tile.openstreetmap.org` + `*.supabase.co`
(repli `<img>` des navigateurs sans `createImageBitmap`) ;
`worker-src 'self'` : le worker MapLibre est un asset de l'origine, émis par
Vite — aucune URL `blob:` n'est autorisée ;
`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
`form-action 'self'`. Toute nouvelle dépendance réseau doit être ajoutée ici
ET dans `vite.config.ts`. Les hôtes de tuiles ne sont plus écrits à la main :
ils sont dérivés de la source (`osmRasterTiles()`) par `mapCspDirectives()`,
qui alimente aussi le cache workbox — une seule déclaration, deux usages.
