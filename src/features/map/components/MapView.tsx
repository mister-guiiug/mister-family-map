import { useEffect, useRef, useState } from 'react';
import { Button, ErrorBanner } from '@mister-guiiug/dev-pwa-config/react';
import { LocateFixed } from 'lucide-react';
import type { Place } from '../../../entities/place/model';
import {
  clusterByGrid,
  clustersToMarkers,
} from '@mister-guiiug/dev-pwa-config/map';
import { createMapLibreMapProvider } from '@mister-guiiug/dev-pwa-config/map/maplibre';
import type { Coordinates } from '@mister-guiiug/dev-pwa-config/geo';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import type { MapProviderFactory, MapViewport } from '../map-provider';

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
        // `onReady` livre la vue INITIALE, une fois : de quoi amorcer le zoom
        // du regroupement. Elle ne remonte PAS à l'appelant — une carte qui
        // finit de s'initialiser n'a rien déplacé, et `PlaceCreatePage` recopie
        // ce callback dans son brouillon : sur une machine lente, l'émission
        // tardive écrasait les coordonnées que l'utilisateur venait de saisir.
        onReady: viewport => setZoom(viewport.zoom),
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
      // Le paquet calcule identifiants, centres et comptes ; on ne reprend la
      // main que sur le libellé du groupe, qui sert d'alternative textuelle et
      // gagne à nommer des « lieux » plutôt que des « éléments ».
      clustersToMarkers(clusters, input => input.item.name).map(marker =>
        marker.count
          ? { ...marker, label: `${marker.count} lieux regroupés` }
          : marker
      )
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
