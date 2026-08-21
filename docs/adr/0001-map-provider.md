# ADR-0001 — Fournisseur cartographique : Leaflet + tuiles OpenStreetMap

Statut : accepté · Date : 2026-08-21

## Contexte

La carte est centrale mais ne doit pas contaminer le domaine : l'app dépend du
port `MapProvider` (`src/features/map/map-provider.ts`) ; un seul adaptateur
(`leaflet/leaflet-map-provider.ts`) importe la bibliothèque.

Candidats évalués : Leaflet (raster), MapLibre GL (vecteur), fournisseurs
commerciaux (Mapbox, Google Maps).

## Décision

**Leaflet 1.9 + tuiles raster OSM (tile.openstreetmap.org)** pour le MVP.

## Avantages

- ~42 ko gzip, API stable depuis une décennie, énorme base de connaissances.
- Aucune clé d'API, aucun compte, aucun coût : idéal pour un MVP familial.
- Tuiles raster simples à mettre en cache de façon bornée (workbox).
- Clustering fait maison possible (grille, `shared/lib/cluster.ts`) → pas de
  dépendance supplémentaire.

## Limites

- Rendu raster : pas de rotation fluide ni de relief vectoriel ; zoom
  fractionnaire moins soigné que MapLibre.
- Le style des tuiles OSM n'est pas personnalisable.
- Performances en deçà de MapLibre au-delà de quelques milliers de marqueurs
  simultanés (notre clustering ramène ce cas à quelques dizaines).

## Coût et conditions d'utilisation

- Bibliothèque : BSD-2, gratuite.
- Tuiles : serveurs de l'OpenStreetMap Foundation, gratuits sous
  [politique d'usage](https://operations.osmfoundation.org/policies/tiles/) —
  usage « raisonnable », pas de préchargement massif, User-Agent identifiable,
  **attribution obligatoire** « © OpenStreetMap » (posée par l'adaptateur,
  non désactivable).
- Géocodage : Nominatim public — max ~1 req/s, attribution affichée
  (`GeocodingService.attribution`). À remplacer par une instance dédiée ou un
  service commercial si le trafic dépasse l'usage familial.

## Hors ligne

Cache borné des tuiles récemment affichées (200 tuiles / 7 jours, workbox
CacheFirst). **Ce n'est pas une carte hors ligne** : hors connexion, seules les
zones déjà vues s'affichent ; l'UI bascule sur la liste (toujours disponible)
et l'indique.

## Stratégie de remplacement

1. Écrire le nouvel adaptateur du port `MapProvider`
   (ex. `maplibre/maplibre-map-provider.ts`).
2. Changer la factory injectée dans `MapView` (une ligne).
3. Mettre à jour la CSP (`vite.config.ts`) et le runtime caching workbox.
4. Mettre à jour cet ADR (nouvelle entrée, celle-ci passe « remplacée »).

Déclencheurs plausibles : besoin de style personnalisé (→ MapLibre + tuiles
vectorielles OpenFreeMap/Protomaps), trafic dépassant la politique OSMF
(→ fournisseur de tuiles payant), besoin 3D/rotation.
