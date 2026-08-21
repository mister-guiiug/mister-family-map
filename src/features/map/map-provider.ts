import type { BoundingBox, Coordinates } from '../../shared/lib/geo';

/**
 * Port MapProvider : le domaine et les écrans ne connaissent QUE cette
 * interface. Le fournisseur initial (Leaflet + tuiles OSM) est un adaptateur
 * remplaçable — critères et stratégie de remplacement dans
 * docs/adr/0001-map-provider.md.
 */

export interface MapMarker {
  id: string;
  coordinates: Coordinates;
  label: string;
  /** > 1 : marqueur de regroupement (cluster). */
  count?: number;
}

export interface MapViewport {
  center: Coordinates;
  zoom: number;
  bounds: BoundingBox;
}

export interface MapProviderOptions {
  center: Coordinates;
  zoom: number;
  /** Attribution imposée par le fournisseur de tuiles — toujours affichée. */
  onMarkerClick?: (id: string) => void;
  onViewportChange?: (viewport: MapViewport) => void;
}

export interface MapProvider {
  /** Monte la carte dans l'élément. Rejette si le fournisseur est indisponible. */
  mount(container: HTMLElement, options: MapProviderOptions): Promise<void>;
  setMarkers(markers: readonly MapMarker[]): void;
  panTo(center: Coordinates, zoom?: number): void;
  getViewport(): MapViewport | null;
  destroy(): void;
}

export type MapProviderFactory = () => MapProvider;
