import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Place } from '../../../entities/place/model';
import { UNKNOWN_FEATURES } from '../../../entities/place/model';
import { PlaceCard } from './PlaceCard';

const place: Place = {
  id: 'p1',
  name: 'Parc de la Tête d’Or',
  categoryId: 'cat-parc',
  shortDescription: 'Grand parc urbain.',
  description: '',
  coordinates: { lat: 45.78, lng: 4.85 },
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

function renderCard(overrides: Partial<Parameters<typeof PlaceCard>[0]> = {}) {
  const onToggleFavorite = vi.fn();
  render(
    <MemoryRouter>
      <PlaceCard
        place={place}
        isFavorite={false}
        onToggleFavorite={onToggleFavorite}
        {...overrides}
      />
    </MemoryRouter>
  );
  return { onToggleFavorite };
}

describe('PlaceCard', () => {
  it('affiche le nom (lien vers la fiche), la ville et la gratuité', () => {
    renderCard();
    expect(
      screen.getByRole('link', { name: 'Parc de la Tête d’Or' })
    ).toHaveAttribute('href', '/lieux/p1');
    expect(screen.getByText('Lyon')).toBeInTheDocument();
    expect(screen.getByText('Gratuit')).toBeInTheDocument();
  });

  it('signale une donnée non vérifiée', () => {
    renderCard();
    expect(screen.getByText('Non vérifié')).toBeInTheDocument();
  });

  it('le bouton favori est accessible et rappelle l’état', async () => {
    const { onToggleFavorite } = renderCard();
    const button = screen.getByRole('button', {
      name: /Ajouter Parc de la Tête d’Or aux favoris/,
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(onToggleFavorite).toHaveBeenCalledWith('p1');
  });
});
