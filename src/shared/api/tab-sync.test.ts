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
    const stop = startTabSync(m => recus.push(m.topic));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });

    // Le MÊME module annonce : son canal d'écoute est un AUTRE
    // BroadcastChannel que celui du post — le message doit arriver.
    announceTabChange({ topic: 'favorites', ids: [] });
    await vi.waitFor(() => expect(recus).toEqual(['favorites']));
    stop();
  });

  it('le backend local annonce ses mutations de favoris', async () => {
    // Le vrai chemin, de bout en bout : le repo écrit, l'annonce part.
    const { startTabSync } = await import('./tab-sync');
    const { createLocalBackend } = await import('./local/local-backend');

    const recus: string[] = [];
    const stop = startTabSync(m => recus.push(m.topic));
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
    const stop = startTabSync(m => recus.push(m.topic));
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
    const stop = startTabSync(m => recus.push(m.topic));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });
    stop();
    announceTabChange({ topic: 'favorites', ids: [] });
    await new Promise(r => setTimeout(r, 20));
    expect(recus).toEqual([]);
  });
});

/**
 * LA COURSE QUE CES TESTS FIGENT (ADR-0007).
 *
 * Le message se contentait d'un sujet ; l'onglet receveur relisait
 * `localStorage`. Rien n'ordonne l'écriture de l'émetteur et l'arrivée du
 * message chez le receveur : sondé dans un vrai navigateur, l'onglet B lisait
 * `mfm_data` ABSENT au moment même où il traitait l'annonce, une fois sur
 * deux. L'E2E multi-onglets échouait à la même fréquence.
 *
 * Ces tests-ci ne SIMULENT pas la course — ils vérifient ce qui la rend
 * impossible : la valeur voyage DANS le message, si bien que l'onglet receveur
 * n'a plus rien à relire.
 */
describe('le message porte la valeur', () => {
  beforeEach(() => {
    bus.clear();
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('l’ajout d’un favori emporte la liste complète', async () => {
    const { startTabSync } = await import('./tab-sync');
    const { createLocalBackend } = await import('./local/local-backend');

    const recus: unknown[] = [];
    const stop = startTabSync(m => recus.push(m));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });

    const backend = createLocalBackend();
    await backend.favorites.add('seed-tete-dor');
    await backend.favorites.add('seed-parc-blandan');

    await vi.waitFor(() => expect(recus).toHaveLength(2));
    expect(recus[0]).toEqual({ topic: 'favorites', ids: ['seed-tete-dor'] });
    expect(recus[1]).toEqual({
      topic: 'favorites',
      ids: ['seed-tete-dor', 'seed-parc-blandan'],
    });
    stop();
  });

  it('le retrait aussi — et la liste devient vide, pas absente', async () => {
    const { startTabSync } = await import('./tab-sync');
    const { createLocalBackend } = await import('./local/local-backend');

    const recus: unknown[] = [];
    const stop = startTabSync(m => recus.push(m));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });

    const backend = createLocalBackend();
    await backend.favorites.add('seed-tete-dor');
    await backend.favorites.remove('seed-tete-dor');

    await vi.waitFor(() => expect(recus).toHaveLength(2));
    expect(recus[1]).toEqual({ topic: 'favorites', ids: [] });
    stop();
  });

  it('la connexion emporte la session, la déconnexion emporte `null`', async () => {
    const { startTabSync } = await import('./tab-sync');
    const { createLocalBackend } = await import('./local/local-backend');

    const recus: { topic: string; session?: unknown }[] = [];
    const stop = startTabSync(m => recus.push(m));
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });

    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('camille@exemple.fr');
    await vi.waitFor(() => expect(recus).toHaveLength(1));
    expect(recus[0]?.topic).toBe('session');
    expect((recus[0]?.session as { userId?: string } | null)?.userId).toBe(
      'local-camille'
    );

    await backend.auth.signOut();
    await vi.waitFor(() => expect(recus).toHaveLength(2));
    expect(recus[1]).toEqual({ topic: 'session', session: null });
    stop();
  });

  it('l’onglet receveur n’a RIEN à relire : le stockage vidé ne change rien', async () => {
    // La preuve directe. On efface `localStorage` entre l'annonce et son
    // traitement : avant le correctif, l'onglet receveur relisait le stockage
    // et repartait avec une liste vide — exactement ce que faisait le
    // navigateur quand l'écriture de l'autre onglet n'était pas encore
    // arrivée.
    const { announceTabChange, startTabSync } = await import('./tab-sync');
    const recus: { topic: string; ids?: readonly string[] }[] = [];
    const stop = startTabSync(m => {
      localStorage.clear();
      recus.push(m);
    });
    await vi.waitFor(() => {
      expect(bus.get('dwc:mfm')?.size ?? 0).toBeGreaterThan(0);
    });

    announceTabChange({ topic: 'favorites', ids: ['seed-tete-dor'] });

    await vi.waitFor(() => expect(recus).toHaveLength(1));
    expect(recus[0]?.ids).toEqual(['seed-tete-dor']);
    expect(localStorage.getItem('mfm_data')).toBeNull();
    stop();
  });
});
