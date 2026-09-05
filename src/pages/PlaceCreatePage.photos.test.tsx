import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { IMAGE_MAX_BYTES } from '@mister-guiiug/dev-pwa-config/image';
import { BackendProvider } from '../app/providers/BackendProvider';
import { createLocalBackend } from '../shared/api/local/local-backend';
import { useAuthStore } from '../features/auth/store';
import { usePlaceWizardStore } from '../features/contributions/place-wizard-store';
import PlaceCreatePage from './PlaceCreatePage';

/**
 * L'étape « photos » est le seul appelant de `validateImageFile`, désormais
 * importé de `@mister-guiiug/dev-pwa-config/image`. Le socle éprouve la
 * MÉCANIQUE du validateur chez lui (`test/promotions.test.mjs`) ; ces tests-ci
 * éprouvent le CÂBLAGE, que le socle ne peut pas voir : que l'écran appelle
 * vraiment le validateur, et traduise chaque refus dans le message que
 * l'utilisateur lit.
 *
 * Le fichier est déposé par `fireEvent` et non par `userEvent.upload` À
 * DESSEIN : ce dernier filtre lui-même sur l'attribut `accept`, si bien que le
 * fichier interdit n'atteindrait jamais le code éprouvé. Or `accept` n'est
 * qu'une suggestion faite au sélecteur — un glisser-déposer ou un sélecteur
 * mobile laxiste le contourne. C'est précisément le cas que la validation
 * JavaScript existe pour couvrir.
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

function renderPhotosStep() {
  useAuthStore.setState({ session });
  usePlaceWizardStore.setState({ step: 'photos' });
  render(
    <MemoryRouter>
      <BackendProvider backend={createLocalBackend()}>
        <PlaceCreatePage />
      </BackendProvider>
    </MemoryRouter>
  );
}

function selectFile(file: File) {
  fireEvent.change(screen.getByLabelText(/Ajouter des photos/), {
    target: { files: [file] },
  });
}

describe('étape photos : l’écran refuse ce que le bucket refuserait', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ session: null });
    usePlaceWizardStore.setState({ step: 'position' });
  });

  it('refuse un PDF choisi à la place d’une photo', async () => {
    renderPhotosStep();
    selectFile(new File(['%PDF-1.7'], 'plan.pdf', { type: 'application/pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Formats acceptés : JPEG, PNG, WebP.'
    );
  });

  it('refuse un SVG — vecteur de XSS — malgré son type `image/…`', async () => {
    renderPhotosStep();
    selectFile(
      new File(['<svg onload="alert(1)" />'], 'piege.svg', {
        type: 'image/svg+xml',
      })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Formats acceptés : JPEG, PNG, WebP.'
    );
  });

  it('refuse une photo au-delà de la limite du socle', async () => {
    renderPhotosStep();
    selectFile(
      new File([new Uint8Array(IMAGE_MAX_BYTES + 1)], 'enorme.png', {
        type: 'image/png',
      })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chaque photo doit faire moins de 5 Mo.'
    );
  });

  it('accepte un JPEG sous la limite, sans rien signaler', async () => {
    renderPhotosStep();
    selectFile(new File(['jpeg'], 'sortie.jpg', { type: 'image/jpeg' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    );
  });
});
