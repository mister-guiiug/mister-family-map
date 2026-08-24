import {
  AttributionControl,
  MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
// MapLibre résout sinon son worker via `new URL('./maplibre-gl-worker.mjs',
// import.meta.url)` — une URL calculée à l'exécution, que le bundler n'émet
// pas : la carte échouerait en production (404) alors qu'elle marche en dev.
// `?worker&url` fait empaqueter le worker AVEC ses dépendances par Vite et
// renvoie l'URL de l'asset réellement publié.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type {
  MapMarker,
  MapProvider,
  MapProviderOptions,
  MapViewport,
} from '../map-provider';

setWorkerUrl(workerUrl);

/**
 * Adaptateur MapLibre GL (rendu WebGL) sur tuiles raster OpenStreetMap.
 * Choix et conditions d'usage : docs/adr/0001-map-provider.md.
 * Seul fichier de l'app qui importe maplibre-gl.
 */

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Délai au-delà duquel on considère la carte indisponible → repli liste. */
const MOUNT_TIMEOUT_MS = 10_000;

/**
 * Style raster défini EN DUR (pas d'URL de style distante) : la carte
 * s'initialise sans requête réseau préalable, donc `mount()` aboutit même hors
 * ligne — seules les tuiles manquent. Aucune clé d'API, aucun compte.
 */
export function createOsmRasterStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [OSM_TILE_URL],
        tileSize: 256,
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  };
}

export interface MapLibreProviderOptions {
  /**
   * Style MapLibre. Défaut : tuiles raster OSM sans clé. Pour passer aux
   * tuiles vectorielles, fournir ici l'URL d'un style SANS clé d'API et
   * déclarer ses hôtes dans la CSP (`vite.config.ts`) — cf. ADR-0001.
   */
  style?: StyleSpecification | string;
}

/** Élément de marqueur : un bouton, donc focusable et activable au clavier. */
function markerElement(marker: MapMarker): HTMLButtonElement {
  const isCluster = (marker.count ?? 1) > 1;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mfm-marker';
  button.setAttribute('aria-label', marker.label);
  const inner = document.createElement('span');
  inner.className = isCluster ? 'mfm-cluster' : 'mfm-pin';
  inner.setAttribute('aria-hidden', 'true');
  if (isCluster) inner.textContent = String(marker.count);
  button.append(inner);
  return button;
}

export function createMapLibreMapProvider(
  providerOptions: MapLibreProviderOptions = {}
): MapProvider {
  let map: MapLibreMap | null = null;
  let markers: Marker[] = [];
  let onMarkerClick: ((id: string) => void) | undefined;

  const toViewport = (m: MapLibreMap): MapViewport => {
    const center = m.getCenter();
    const b = m.getBounds();
    return {
      center: { lat: center.lat, lng: center.lng },
      zoom: m.getZoom(),
      bounds: {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      },
    };
  };

  const clearMarkers = () => {
    for (const marker of markers) marker.remove();
    markers = [];
  };

  return {
    mount(container, options: MapProviderOptions) {
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        let instance: MapLibreMap;
        try {
          // Lève si WebGL est indisponible (GPUInitializationError).
          instance = new MapLibreMap({
            container,
            style: providerOptions.style ?? createOsmRasterStyle(),
            center: [options.center.lng, options.center.lat],
            zoom: options.zoom,
            maxZoom: 19,
            // Attribution imposée par la source, jamais masquée.
            attributionControl: false,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        map = instance;
        onMarkerClick = options.onMarkerClick;

        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('Carte indisponible : délai de montage dépassé.'));
        }, MOUNT_TIMEOUT_MS);

        instance.addControl(new AttributionControl({ compact: true }));
        instance.addControl(new NavigationControl(), 'bottom-right');

        if (options.onViewportChange) {
          instance.on('moveend', () => {
            options.onViewportChange?.(toViewport(instance));
          });
        }

        instance.once('load', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          options.onViewportChange?.(toViewport(instance));
          resolve();
        });

        // Les échecs de tuiles (hors ligne, serveur OSM injoignable, CSP) NE
        // sont PAS fatals : la carte reste manipulable, seul le fond manque.
        // Un vrai échec de montage se manifeste par une exception du
        // constructeur (WebGL indisponible) ou par l'absence de `load` — d'où
        // le garde-fou de délai ci-dessus.
        instance.on('error', () => {
          /* volontairement ignoré : cf. commentaire ci-dessus */
        });
      });
    },

    setMarkers(next: readonly MapMarker[]) {
      if (!map) return;
      clearMarkers();
      for (const marker of next) {
        const element = markerElement(marker);
        element.addEventListener('click', event => {
          // Sans cela, MapLibre interprète le clic comme un début de déplacement.
          event.stopPropagation();
          onMarkerClick?.(marker.id);
        });
        markers.push(
          new Marker({
            element,
            anchor: (marker.count ?? 1) > 1 ? 'center' : 'bottom',
          })
            .setLngLat([marker.coordinates.lng, marker.coordinates.lat])
            .addTo(map)
        );
      }
    },

    panTo(center, zoom) {
      map?.jumpTo({
        center: [center.lng, center.lat],
        zoom: zoom ?? map.getZoom(),
      });
    },

    getViewport() {
      return map ? toViewport(map) : null;
    },

    destroy() {
      clearMarkers();
      map?.remove();
      map = null;
      onMarkerClick = undefined;
    },
  };
}
