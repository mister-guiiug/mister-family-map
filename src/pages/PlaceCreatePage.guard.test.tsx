import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BackendProvider } from '../app/providers/BackendProvider';
import { createLocalBackend } from '../shared/api/local/local-backend';
import type { Backend } from '../shared/api/ports';
import { useAuthStore } from '../features/auth/store';
import { usePlaceWizardStore } from '../features/contributions/place-wizard-store';
import PlaceCreatePage from './PlaceCreatePage';

/**
 * DEUX DÉFAUTS, ÉPROUVÉS ICI PAR L'USAGE.
 *
 * 1. « Envoyer la contribution » était grisé sans un mot : au bout de sept
 *    écrans, un bouton mort et aucune indication de ce qui manque.
 * 2. Avec l'adaptateur Supabase, un envoi hors connexion partait quand même
 *    et revenait en « Failed to fetch » — une phrase que personne ne peut
 *    interpréter, APRÈS avoir fait attendre.
 *
 * Le troisième test est le plus important : il interdit la sur-correction.
 * Avec l'adaptateur local — la configuration livrée aujourd'hui — l'envoi
 * réussit hors connexion. Bloquer serait un mensonge, et un mensonge que
 * personne ne viendrait signaler.
 */

const session = {
  userId: 'u1',
  profile: {
    id: 'u1',
    displayName: 'Camille',
    role: 'member' as const,
    createdAt: '2026-08-01T10:00:00+02:00',
  },
};

/** Le même backend, mais dont le dépôt de lieux écrit par le réseau. */
function withRemotePlaces(backend: Backend): Backend {
  return { ...backend, places: { ...backend.places, requiresNetwork: true } };
}

function renderRulesStep(backend: Backend, { rules = true } = {}) {
  useAuthStore.setState({ session });
  usePlaceWizardStore.setState({ step: 'regles', rulesAccepted: rules });
  render(
    <MemoryRouter>
      <BackendProvider backend={backend}>
        <PlaceCreatePage />
      </BackendProvider>
    </MemoryRouter>
  );
}

const submitButton = () =>
  screen.getByRole('button', { name: 'Envoyer la contribution' });

function goOffline() {
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

describe('l’envoi d’une contribution dit pourquoi il est bloqué', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ session: null });
    usePlaceWizardStore.setState({ step: 'position', rulesAccepted: false });
  });

  it('règles non acceptées : bouton désactivé ET motif affiché', () => {
    renderRulesStep(createLocalBackend(), { rules: false });

    expect(submitButton()).toBeDisabled();
    expect(
      screen.getByText(/Acceptez les règles de contribution/)
    ).toHaveAttribute('role', 'status');
  });

  it('hors connexion avec un dépôt distant : le motif est le réseau, pas les règles', () => {
    renderRulesStep(withRemotePlaces(createLocalBackend()));
    expect(submitButton()).toBeEnabled();

    goOffline();

    expect(submitButton()).toBeDisabled();
    // Le libellé du paquet, en français, sans avoir à le recopier ici.
    expect(screen.getByText('Indisponible hors ligne')).toHaveAttribute(
      'role',
      'status'
    );
  });

  it('hors connexion avec le dépôt local : rien n’est bloqué, car rien n’échoue', () => {
    renderRulesStep(createLocalBackend());

    goOffline();

    expect(submitButton()).toBeEnabled();
    expect(screen.queryByText('Indisponible hors ligne')).toBeNull();
  });
});
