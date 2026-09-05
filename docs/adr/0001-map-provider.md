# ADR-0001 — Fournisseur cartographique : MapLibre GL + tuiles OpenStreetMap

Statut : accepté · Date : 2026-08-25
(2026-08-21 « Leaflet + tuiles OSM » → 2026-08-24 MapLibre → 2026-08-25 socle
remonté dans le paquet partagé)

## Contexte

La carte est centrale mais ne doit pas contaminer le domaine : l'app dépend du
port `MapProvider`, réexporté par `src/features/map/map-provider.ts` depuis
**`@mister-guiiug/dev-pwa-config/map`** — l'app n'implémente plus d'adaptateur.

Candidats évalués : Leaflet (raster), MapLibre GL (WebGL), fournisseurs
commerciaux (Mapbox, Google Maps).

## Décision

**MapLibre GL JS 6 + tuiles raster OSM (tile.openstreetmap.org)**, avec un
style défini **en dur dans l'adaptateur** (pas d'URL de style distante).

Le passage de Leaflet à MapLibre a coûté un seul fichier d'adaptateur : le port
a tenu, aucun écran n'a changé. C'est ce qui a justifié de remonter l'ensemble
— port, adaptateurs Leaflet ET MapLibre, regroupement, helpers CSP et cache —
dans le paquet partagé, où les trois pièges ci-dessous sont traités une fois
pour toutes. L'app fournit désormais uniquement l'habillage CSS des marqueurs
(`.dwc-map-marker` / `.dwc-map-pin` / `.dwc-map-cluster`) et son repli liste.

## Avantages

- Rendu WebGL : zoom fractionnaire fluide, rotation et inclinaison, meilleure
  tenue en charge que le rendu DOM de Leaflet.
- Aucune clé d'API, aucun compte, aucun coût : le style raster OSM est monté
  en local, sans requête de style préalable.
- Voie ouverte vers les **tuiles vectorielles** (style personnalisé, étiquettes
  nettes en haute densité) sans changer d'adaptateur — cf. « Évolutions ».
- BSD-3, gouvernance communautaire (fork libre de Mapbox GL JS v1).
- Clustering fait maison conservé (grille, `shared/lib/cluster.ts`) → pas de
  dépendance supplémentaire.

## Limites

- **Poids** : ~253 ko gzip contre ~42 ko pour Leaflet. Atténué par le
  chargement paresseux : le bundle carte n'est tiré que sur les écrans qui
  l'utilisent (`MapView` est dans un chunk séparé), jamais au démarrage.
- **WebGL requis** : sur un appareil ou un navigateur sans WebGL, la carte ne
  monte pas. L'adaptateur rejette alors le montage et l'écran bascule sur la
  liste (repli déjà prévu par `MapView`).
- Le style des tuiles raster OSM n'est toujours pas personnalisable (il le
  deviendrait avec des tuiles vectorielles).

## Contraintes d'intégration (non évidentes)

Trois pièges rencontrés, tous vérifiés en navigateur sur le build de
production — ils ne se voient pas en développement :

1. **Web Worker** : MapLibre résout son worker via
   `new URL('./maplibre-gl-worker.mjs', import.meta.url)`, URL calculée à
   l'exécution que le bundler n'émet pas → 404 en production. L'adaptateur
   impose donc l'URL via `setWorkerUrl()` et un import
   `…/maplibre-gl-worker.mjs?worker&url`, qui fait empaqueter le worker **avec
   ses dépendances** par Vite. Le worker est un asset de l'origine (donc
   `worker-src 'self'` suffit, sans `blob:`) et il est précaché par workbox.
   **Contrepartie** : ce suffixe `?worker&url` n'est pas compris par le
   pré-bundling des dépendances de Vite. L'adaptateur vivant dans
   `node_modules`, `npm run dev` refusait de démarrer jusqu'à ce que
   `optimizeDeps.exclude` sorte ce sous-chemin de l'optimiseur — voir
   `vite.config.ts`. Le build de production, lui, n'a jamais été concerné :
   c'est l'exact symétrique du piège nº 1.
2. **CSP** : MapLibre récupère les tuiles raster par `fetch`, pas par `<img>` —
   elles relèvent de **`connect-src`**. L'hôte reste aussi dans `img-src` pour
   le repli `<img>` des navigateurs sans `createImageBitmap`.
3. **Erreurs de tuiles non fatales** : une tuile qui échoue (hors ligne, CSP,
   serveur injoignable) ne doit jamais faire échouer le montage. Seuls comptent
   l'exception du constructeur (WebGL absent) et l'absence d'événement `load`
   au-delà d'un délai borné.

## Coût et conditions d'utilisation

- Bibliothèque : BSD-3, gratuite.
- Tuiles : serveurs de l'OpenStreetMap Foundation, gratuits sous
  [politique d'usage](https://operations.osmfoundation.org/policies/tiles/) —
  usage « raisonnable », pas de préchargement massif, User-Agent identifiable,
  **attribution obligatoire** « © OpenStreetMap » (portée par la source du
  style et rendue par `AttributionControl`, non désactivable).
- Géocodage : Nominatim public — max ~1 req/s, attribution affichée
  (`GeocodingService.attribution`). À remplacer par une instance dédiée ou un
  service commercial si le trafic dépasse l'usage familial.

## Hors ligne

Cache borné des tuiles récemment affichées (200 tuiles / 7 jours, workbox
CacheFirst). **Ce n'est pas une carte hors ligne** : hors connexion, seules les
zones déjà vues s'affichent ; l'UI bascule sur la liste (toujours disponible)
et l'indique. Le style étant local, la carte s'initialise même sans réseau.

## Évolutions

**Tuiles vectorielles** : passer `style` à `createMapLibreMapProvider()` (URL
d'un style sans clé d'API, ex. OpenFreeMap ; ou un style local pointant des
tuiles auto-hébergées). Ajouter alors les hôtes du style, des tuiles, des
glyphes et des sprites à `connect-src` **et** `img-src` dans `vite.config.ts`,
et revoir le `runtimeCaching` workbox (les tuiles ne sont plus des `.png`).
Attention : avec un style distant, le montage devient dépendant du réseau —
le garde-fou de délai de l'adaptateur prend alors tout son sens.

**Changer de moteur** : écrire un adaptateur du port `MapProvider`, changer la
factory par défaut dans `MapView` (une ligne), mettre à jour CSP et workbox,
puis remplacer cet ADR.
