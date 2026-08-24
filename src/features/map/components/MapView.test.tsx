import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Place } from '../../../entities/place/model';
import { UNKNOWN_FEATURES } from '../../../entities/place/model';
import type { MapMarker, MapProvider } from '../map-provider';
import { MapView } from './MapView';

/**
 * Ces tests portent sur le CONTRAT du port MapProvider, pas sur MapLibre :
 * c'est ce qui permet de changer de fournisseur cartographique sans toucher
 * aux écrans (cf. docs/adr/0001-map-provider.md).
 */

function makePlace(id: string, lat: number, lng: number, name: string): Place {
  return {
    id,
    name,
    categoryId: 'cat-parc',
    shortDescription: '',
    description: '',
    coordinates: { lat, lng },
    address: '',
    city: 'Lyon',
    ageRange: null,
    durationMinutes: null,
    price: { kind: 'free' },
    openingHours: null,
    websiteUrl: null,
    phone: null,
    features: { ...UNKNOWN_FEATURES },
    practicalTips: '',
    status: 'published',
    authorId: 'u1',
    lastVerifiedAt: null,
    photos: [],
    createdAt: '2026-08-01T10:00:00+02:00',
    updatedAt: '2026-08-01T10:00:00+02:00',
    deletedAt: null,
  };
}

/** Double du port : aucune dépendance à un moteur de carte réel. */
function fakeProvider(overrides: Partial<MapProvider> = {}) {
  const received: MapMarker[][] = [];
  const provider: MapProvider = {
    mount: vi.fn(async () => {}),
    setMarkers: vi.fn((markers: readonly MapMarker[]) => {
      received.push([...markers]);
    }),
    panTo: vi.fn(),
    getViewport: vi.fn(() => null),
    destroy: vi.fn(),
    ...overrides,
  };
  return { provider, received };
}

describe('MapView', () => {
  it('monte la carte et transmet les marqueurs au fournisseur', async () => {
    const { provider, received } = fakeProvider();
    render(
      <MapView
        places={[makePlace('p1', 45.78, 4.85, 'Parc de la Tête d’Or')]}
        onOpenPlace={vi.fn()}
        providerFactory={() => provider}
      />
    );

    await waitFor(() => expect(provider.mount).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    const last = received.at(-1);
    expect(last).toHaveLength(1);
    expect(last?.[0]?.id).toBe('p1');
  });

  it('regroupe les lieux voisins en un marqueur compté', async () => {
    const { provider, received } = fakeProvider();
    render(
      <MapView
        places={[
          makePlace('p1', 45.78, 4.85, 'Parc'),
          makePlace('p2', 45.781, 4.851, 'Musée'),
        ]}
        onOpenPlace={vi.fn()}
        providerFactory={() => provider}
      />
    );

    await waitFor(() => expect(provider.setMarkers).toHaveBeenCalled());
    const last = received.at(-1);
    expect(last).toHaveLength(1);
    expect(last?.[0]?.count).toBe(2);
    expect(last?.[0]?.id.startsWith('cluster-')).toBe(true);
  });

  it('bascule sur le repli textuel si le fournisseur ne monte pas', async () => {
    const { provider } = fakeProvider({
      mount: vi.fn(async () => {
        throw new Error('WebGL indisponible');
      }),
    });
    render(
      <MapView
        places={[makePlace('p1', 45.78, 4.85, 'Parc')]}
        onOpenPlace={vi.fn()}
        providerFactory={() => provider}
      />
    );

    expect(
      await screen.findByText(/carte est indisponible/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });

  it('libère le fournisseur au démontage', async () => {
    const { provider } = fakeProvider();
    const { unmount } = render(
      <MapView
        places={[]}
        onOpenPlace={vi.fn()}
        providerFactory={() => provider}
      />
    );
    await waitFor(() => expect(provider.mount).toHaveBeenCalled());
    unmount();
    expect(provider.destroy).toHaveBeenCalledTimes(1);
  });
});
