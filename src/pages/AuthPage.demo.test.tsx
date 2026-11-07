import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { BackendProvider } from '../app/providers/BackendProvider';
import { createLocalBackend } from '../shared/api/local/local-backend';
import type { Backend } from '../shared/api/ports';
import { useAuthStore } from '../features/auth/store';
import {
  clearQueryClient,
  wrapWithQueryClient,
} from '../shared/queries/testing';
import AuthPage from './AuthPage';

/*
 * « RECEVOIR LE LIEN DE CONNEXION » N'ENVOYAIT RIEN.
 *
 * Avec le backend local — celui du site publié —, le bouton ouvrait aussitôt
 * une session de démonstration, sans e-mail, et l'écran promettait le
 * contraire. Il dit désormais ce qu'il fait, et le bandeau dit que rien
 * n'est partagé. Avec un dépôt de lieux distant, l'écran d'avant revient.
 */

/** Le même backend, mais dont le dépôt de lieux écrit par le réseau. */
function withRemotePlaces(backend: Backend): Backend {
  return { ...backend, places: { ...backend.places, requiresNetwork: true } };
}

function renderAuth(backend: Backend) {
  render(
    wrapWithQueryClient(
      <MemoryRouter initialEntries={['/connexion']}>
        <BackendProvider backend={backend}>
          <Routes>
            <Route path="/connexion" element={<AuthPage />} />
            <Route path="/profil" element={<p>Page profil</p>} />
          </Routes>
        </BackendProvider>
      </MemoryRouter>
    )
  );
}

describe('la connexion dit la démonstration', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ session: null });
  });
  afterEach(() => clearQueryClient());

  it('en démonstration : bandeau, bouton qui dit ce qu’il fait, aucun e-mail promis', async () => {
    const backend = createLocalBackend();
    renderAuth(backend);

    expect(screen.getByRole('note')).toHaveTextContent(
      'Ce que vous ajoutez reste dans ce navigateur, rien n’est partagé.'
    );
    expect(screen.getByText(/Aucun e-mail n’est envoyé/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Recevoir le lien de connexion' })
    ).toBeNull();

    // Et le bouton fait bien ce qu'il annonce : une session, tout de suite.
    await userEvent.type(
      screen.getByLabelText(/Adresse e-mail/),
      'famille@exemple.fr'
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Ouvrir une session de démonstration',
      })
    );
    expect(await screen.findByText('Page profil')).toBeInTheDocument();
    expect(await backend.auth.getSession()).not.toBeNull();
  });

  it('avec un dépôt de lieux distant : ni bandeau, ni mention de démonstration', () => {
    renderAuth(withRemotePlaces(createLocalBackend()));

    expect(screen.queryByRole('note')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Recevoir le lien de connexion' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/démonstration/i)).toBeNull();
  });
});
