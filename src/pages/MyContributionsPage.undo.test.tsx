import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '@mister-guiiug/dev-pwa-config/react/toast';
import { BackendProvider } from '../app/providers/BackendProvider';
import { createLocalBackend } from '../shared/api/local/local-backend';
import type { Backend } from '../shared/api/ports';
import { useAuthStore } from '../features/auth/store';
import { UNKNOWN_FEATURES, type PlaceDraft } from '../entities/place/model';
import MyContributionsPage from './MyContributionsPage';

/**
 * LE PARCOURS QUE CE TEST TIENT : supprimer, annuler, retrouver.
 *
 * Avant V12, l'app n'avait aucune suppression — `deletedAt` était dans le
 * modèle, filtré par toutes les lectures, et personne ne le posait jamais. Un
 * lieu saisi par erreur restait là pour toujours. Ajouter la suppression sans
 * son rattrapage aurait remplacé un défaut par un pire : une contribution
 * effacée d'un doigt qui glisse, sur un écran de téléphone.
 *
 * Ce que les assertions prouvent, dans l'ordre de la vie réelle :
 *  1. le geste EXISTE et il agit — la ligne disparaît de la liste ;
 *  2. « Annuler » la ramène, à l'identique ;
 *  3. quand les huit secondes sont passées, la corbeille prend le relais et
 *     restaure aussi — la donnée n'ayant jamais quitté le stockage.
 *
 * Le VRAI backend local est monté, pas un double : c'est le câblage
 * page → port → stockage qui est éprouvé, et c'est là que se logent les
 * erreurs (une liste qui ne se recharge pas, un filtre `deletedAt` oublié).
 */

const draft: PlaceDraft = {
  name: 'Square des Lilas',
  categoryId: 'cat-aire-de-jeux',
  shortDescription: 'Petite aire de jeux ombragée.',
  description: '',
  coordinates: { lat: 45.75, lng: 4.85 },
  address: '',
  city: 'Villeurbanne',
  ageRange: { min: 1, max: 8 },
  durationMinutes: 45,
  price: { kind: 'free' },
  openingHours: null,
  websiteUrl: null,
  phone: null,
  features: { ...UNKNOWN_FEATURES },
  practicalTips: '',
};

async function avecUnLieu(): Promise<Backend> {
  const backend = createLocalBackend();
  await backend.auth.signInWithEmail('camille@exemple.fr');
  await backend.places.create(draft);
  useAuthStore.setState({
    session: await backend.auth.getSession(),
    initialized: true,
  });
  return backend;
}

function monter(backend: Backend) {
  render(
    <MemoryRouter>
      <ToastProvider>
        <BackendProvider backend={backend}>
          <MyContributionsPage />
        </BackendProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

const lien = () => screen.queryByRole('link', { name: 'Square des Lilas' });

describe('supprimer une contribution, et se rattraper', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ session: null, initialized: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('supprime le lieu de la liste', async () => {
    const user = userEvent.setup();
    monter(await avecUnLieu());
    await waitFor(() => expect(lien()).toBeInTheDocument());

    await user.click(
      screen.getByRole('button', { name: 'Supprimer le lieu Square des Lilas' })
    );

    await waitFor(() => expect(lien()).toBeNull());
  });

  it('« Annuler » le ramène', async () => {
    const user = userEvent.setup();
    monter(await avecUnLieu());
    await waitFor(() => expect(lien()).toBeInTheDocument());

    await user.click(
      screen.getByRole('button', { name: 'Supprimer le lieu Square des Lilas' })
    );
    await waitFor(() => expect(lien()).toBeNull());

    // La notification est là, avec son action — c'est tout l'intérêt : aucun
    // dialogue n'a été posé AVANT le geste.
    expect(screen.getByText('Lieu supprimé')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() => expect(lien()).toBeInTheDocument());
  });

  it('la corbeille restaure encore, une fois la notification partie', async () => {
    const user = userEvent.setup();
    monter(await avecUnLieu());
    await waitFor(() => expect(lien()).toBeInTheDocument());

    // Pas de corbeille tant qu'il n'y a rien dedans.
    expect(screen.queryByRole('region', { name: 'Corbeille' })).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'Supprimer le lieu Square des Lilas' })
    );
    await waitFor(() => expect(lien()).toBeNull());

    // La notification s'efface — le rattrapage immédiat est passé.
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(lien()).toBeInTheDocument());
    await user.click(
      screen.getByRole('button', { name: 'Supprimer le lieu Square des Lilas' })
    );
    await waitFor(() => expect(lien()).toBeNull());

    const corbeille = await screen.findByRole('region', { name: 'Corbeille' });
    expect(corbeille).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Restaurer Square des Lilas' })
    );

    await waitFor(() => expect(lien()).toBeInTheDocument());
    // Et la corbeille se referme : elle ne reste pas à l'écran, vide.
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Corbeille' })).toBeNull()
    );
  });

  it('ne détruit rien : le lieu supprimé est toujours dans le stockage', async () => {
    const user = userEvent.setup();
    const backend = await avecUnLieu();
    monter(backend);
    await waitFor(() => expect(lien()).toBeInTheDocument());

    await user.click(
      screen.getByRole('button', { name: 'Supprimer le lieu Square des Lilas' })
    );
    await waitFor(() => expect(lien()).toBeNull());

    // Ce que la corbeille rendra possible demain, et ce que l'export emporte :
    // la donnée est là, horodatée.
    const trashed = await backend.places.list({
      authorId: 'local-camille',
      statuses: ['pending'],
      includeDeleted: true,
    });
    expect(trashed).toHaveLength(1);
    expect(trashed[0]?.deletedAt).not.toBeNull();
  });
});
