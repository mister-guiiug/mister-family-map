import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * LE DÉFAUT QUE CE TEST TIENT. Deux onglets partagent `localStorage` mais pas
 * leurs stores : ajouter un favori dans l'un ne changeait rien dans l'autre
 * avant un rechargement. Le câblage passe par le port temps réel du socle sur
 * son transport local (`BroadcastChannel`) — et c'est aussi son banc d'essai :
 * le port a été conçu sans usage réel, celui-ci en est le premier.
 *
 * `BroadcastChannel` est simulé par un bus en mémoire au contrat identique :
 * jsdom ne le fournit pas, et le vrai est éprouvé par l'E2E multi-onglets.
 */

const bus = new Map<string, Set<FakeBroadcastChannel>>();

class FakeBroadcastChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly name: string) {
    if (!bus.has(name)) bus.set(name, new Set());
    bus.get(name)!.add(this);
  }
  postMessage(data: unknown) {
    // Comme le vrai : l'émetteur ne se reçoit PAS lui-même.
    for (const other of bus.get(this.name)!) {
      if (other !== this) other.onmessage?.({ data });
    }
  }
  close() {
    bus.get(this.name)!.delete(this);
  }
}

describe('la synchronisation entre onglets', () => {
  beforeEach(() => {
    bus.clear();
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    // Modules à état de module (transport créé à l'import) : repartir propre.
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('une annonce atteint l’autre onglet, pas soi-même', async () => {
    const { announceTabChange, startTabSync } = await import('./tab-sync');
    const recus: string[] = [];
    const stop = startTabSync(topic => recus.push(topic));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });

    // Le MÊME module annonce : son canal d'écoute est un AUTRE
    // BroadcastChannel que celui du post — le message doit arriver.
    announceTabChange('favorites');
    await vi.waitFor(() => expect(recus).toEqual(['favorites']));
    stop();
  });

  it('le backend local annonce ses mutations de favoris', async () => {
    // Le vrai chemin, de bout en bout : le repo écrit, l'annonce part.
    const { startTabSync } = await import('./tab-sync');
    const { createLocalBackend } = await import('./local/local-backend');

    const recus: string[] = [];
    const stop = startTabSync(topic => recus.push(topic));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });

    const backend = createLocalBackend();
    await backend.favorites.add('seed-parc-blandan');
    await vi.waitFor(() => expect(recus).toContain('favorites'));

    await backend.favorites.remove('seed-parc-blandan');
    await vi.waitFor(() =>
      expect(recus.filter(t => t === 'favorites')).toHaveLength(2)
    );
    stop();
  });

  it('ajouter un favori DÉJÀ présent n’annonce rien', async () => {
    // Rien n'a changé : notifier ferait recharger l'autre onglet pour rien.
    const { startTabSync } = await import('./tab-sync');
    const { createLocalBackend } = await import('./local/local-backend');

    const recus: string[] = [];
    const stop = startTabSync(topic => recus.push(topic));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });

    const backend = createLocalBackend();
    await backend.favorites.add('seed-parc-blandan');
    await vi.waitFor(() => expect(recus).toHaveLength(1));
    await backend.favorites.add('seed-parc-blandan');
    // Laisser une chance au message de partir s'il partait — il ne doit pas.
    await new Promise(r => setTimeout(r, 20));
    expect(recus).toHaveLength(1);
    stop();
  });

  it('stop() ferme l’écoute', async () => {
    const { announceTabChange, startTabSync } = await import('./tab-sync');
    const recus: string[] = [];
    const stop = startTabSync(topic => recus.push(topic));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });
    stop();
    announceTabChange('favorites');
    await new Promise(r => setTimeout(r, 20));
    expect(recus).toEqual([]);
  });
});
