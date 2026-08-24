import { useEffect, useRef, useState } from 'react';
import { Button, ErrorBanner } from '@mister-guiiug/dev-wpa-config/react';
import { LocateFixed } from 'lucide-react';
import type { Place } from '../../../entities/place/model';
import { clusterByGrid } from '../../../shared/lib/cluster';
import type { Coordinates } from '../../../shared/lib/geo';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import type { MapProviderFactory, MapViewport } from '../map-provider';
import { createMapLibreMapProvider } from '../maplibre/maplibre-map-provider';

/** Centre par défaut (France) tant qu'aucune position n'est consentie. */
const DEFAULT_CENTER: Coordinates = { lat: 46.6, lng: 2.4 };
const DEFAULT_ZOOM = 6;

export interface MapViewProps {
  places: readonly Place[];
  onOpenPlace: (placeId: string) => void;
  onViewportChange?: ((viewport: MapViewport) => void) | undefined;
  onUserLocated?: ((coordinates: Coordinates) => void) | undefined;
  /** Injectable en test ; MapLibre GL par défaut. */
  providerFactory?: MapProviderFactory;
  /** Alternative textuelle : liste liée affichée ailleurs sur l'écran. */
  ariaLabel?: string;
}

/**
 * Vue carte branchée sur le port MapProvider. Si le fournisseur ne monte pas
 * (tuiles bloquées, hors ligne), un repli textuel est affiché — la liste reste
 * le chemin d'accès garanti aux données.
 */
export function MapView({
  places,
  onOpenPlace,
  onViewportChange,
  onUserLocated,
  providerFactory = createMapLibreMapProvider,
  ariaLabel = 'Carte des lieux — la liste ci-dessous présente les mêmes résultats',
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<ReturnType<MapProviderFactory> | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const geolocation = useGeolocation();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const provider = providerFactory();
    providerRef.current = provider;
    let cancelled = false;

    provider
      .mount(container, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        onMarkerClick: onOpenPlace,
        onViewportChange: viewport => {
          setZoom(viewport.zoom);
          onViewportChange?.(viewport);
        },
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      provider.destroy();
      providerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montage unique
  }, [providerFactory]);

  // Marqueurs regroupés selon le zoom courant.
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || failed) return;
    const clusters = clusterByGrid(
      places.map(p => ({ id: p.id, coordinates: p.coordinates, item: p })),
      zoom
    );
    provider.setMarkers(
      clusters.map(c => {
        const first = c.items[0];
        return c.items.length === 1 && first
          ? {
              id: first.id,
              coordinates: first.coordinates,
              label: first.item.name,
            }
          : {
              id: `cluster-${c.coordinates.lat.toFixed(3)}-${c.coordinates.lng.toFixed(3)}`,
              coordinates: c.coordinates,
              label: `${c.items.length} lieux regroupés`,
              count: c.items.length,
            };
      })
    );
  }, [places, zoom, failed]);

  // Recentrage après consentement.
  useEffect(() => {
    if (geolocation.status === 'granted' && geolocation.coordinates) {
      providerRef.current?.panTo(geolocation.coordinates, 13);
      onUserLocated?.(geolocation.coordinates);
    }
  }, [geolocation.status, geolocation.coordinates, onUserLocated]);

  if (failed) {
    return (
      <div className="p-fluid-md">
        <ErrorBanner
          severity="warning"
          message="La carte est indisponible pour le moment. Les résultats restent consultables dans la liste ci-dessous."
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        role="region"
        aria-label={ariaLabel}
        className="h-[55vh] min-h-72 w-full rounded-(--radius-card) border border-line"
        data-testid="map-container"
      />
      <div className="absolute right-2 top-2 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={geolocation.request}
          loading={geolocation.status === 'loading'}
        >
          <LocateFixed size={18} aria-hidden="true" />
          Autour de moi
        </Button>
      </div>
      {geolocation.status === 'denied' ? (
        <p role="status" className="mt-2 text-fluid-xs text-ink-soft">
          Géolocalisation refusée — la recherche par commune reste disponible.
        </p>
      ) : null}
    </div>
  );
}
