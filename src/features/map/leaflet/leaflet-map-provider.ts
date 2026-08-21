import L from 'leaflet';
import type {
  MapMarker,
  MapProvider,
  MapProviderOptions,
  MapViewport,
} from '../map-provider';

/**
 * Adaptateur Leaflet + tuiles raster OpenStreetMap (choix documenté dans
 * docs/adr/0001-map-provider.md — attribution obligatoire, politique d'usage
 * des tuiles OSMF). Seul fichier de l'app qui importe Leaflet.
 */

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Icône SVG inline : pas d'assets Leaflet par défaut (chemins cassés en bundle). */
function markerIcon(count: number): L.DivIcon {
  const isCluster = count > 1;
  const size = isCluster ? 40 : 34;
  const html = isCluster
    ? `<div class="mfm-cluster" aria-hidden="true">${count}</div>`
    : `<div class="mfm-pin" aria-hidden="true"></div>`;
  return L.divIcon({
    html,
    className: 'mfm-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, isCluster ? size / 2 : size],
  });
}

export function createLeafletMapProvider(): MapProvider {
  let map: L.Map | null = null;
  let markerLayer: L.LayerGroup | null = null;

  const toViewport = (m: L.Map): MapViewport => {
    const b = m.getBounds();
    return {
      center: { lat: m.getCenter().lat, lng: m.getCenter().lng },
      zoom: m.getZoom(),
      bounds: {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      },
    };
  };

  return {
    async mount(container, options: MapProviderOptions) {
      map = L.map(container, {
        center: [options.center.lat, options.center.lng],
        zoom: options.zoom,
        zoomControl: true,
      });
      L.tileLayer(OSM_TILE_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);

      if (options.onViewportChange) {
        const emit = () => {
          if (map) options.onViewportChange?.(toViewport(map));
        };
        map.on('moveend', emit);
        map.whenReady(emit);
      }
      this.setMarkers = markers => {
        if (!markerLayer) return;
        markerLayer.clearLayers();
        for (const marker of markers) {
          const m = L.marker([marker.coordinates.lat, marker.coordinates.lng], {
            icon: markerIcon(marker.count ?? 1),
            alt: marker.label,
            keyboard: true,
          });
          m.on('click', () => options.onMarkerClick?.(marker.id));
          m.addTo(markerLayer);
        }
      };
    },

    setMarkers(_markers: readonly MapMarker[]) {
      // Remplacée au mount() — no-op avant montage.
    },

    panTo(center, zoom) {
      map?.setView([center.lat, center.lng], zoom ?? map.getZoom());
    },

    getViewport() {
      return map ? toViewport(map) : null;
    },

    destroy() {
      map?.remove();
      map = null;
      markerLayer = null;
    },
  };
}
