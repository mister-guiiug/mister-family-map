import { beforeEach, describe, expect, it } from 'vitest';
import { store } from './storage';

/**
 * LE RISQUE DE CETTE BASCULE. Passer du fichier local au stockage du socle
 * change la façon dont les clés sont FABRIQUÉES : les littéraux `mfm_places`
 * deviennent `store.get('places')` sur un magasin préfixé. Si le préfixe se
 * perd — ou double — les lieux, les favoris et la session des utilisateurs qui
 * ont l'app installée deviennent introuvables du jour au lendemain, sans
 * erreur, sans message : l'app repart simplement sur les données de
 * démonstration.
 *
 * Ces tests figent donc les clés RÉELLES, celles écrites dans localStorage.
 */
describe('les clés du stockage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restent identiques à l’octet après la bascule', () => {
    store.set('places', [{ id: 'x' }]);
    store.set('favorites', ['a']);
    store.set('session', { userId: 'u' });
    store.set('place_wizard_draft', { step: 'position' });

    // Exactement ce que `local-backend.ts` écrivait avant la bascule.
    expect(localStorage.getItem('mfm_places')).toBe('[{"id":"x"}]');
    expect(localStorage.getItem('mfm_favorites')).toBe('["a"]');
    expect(localStorage.getItem('mfm_session')).toBe('{"userId":"u"}');
    // Le brouillon de l'assistant : c'est lui qu'on lisait dans le dump du
    // parcours critique en échec, à cette clé exacte.
    expect(localStorage.getItem('mfm_place_wizard_draft')).toBe(
      '{"step":"position"}'
    );
    // Et surtout : pas de double préfixe.
    expect(localStorage.getItem('mfm_mfm_places')).toBeNull();
  });

  it('relisent les données écrites par la version PRÉCÉDENTE', () => {
    // Ce que trouve l'app chez un utilisateur qui met à jour.
    localStorage.setItem('mfm_places', '[{"id":"seed-parc"}]');
    expect(store.get('places', [])).toEqual([{ id: 'seed-parc' }]);
  });

  it('n’effacent que ce qui appartient à l’app', () => {
    localStorage.setItem('mfm_places', '[]');
    // Une autre app de la famille, sur le même domaine.
    localStorage.setItem('mistermolkky_settings', '{"theme":"sombre"}');

    store.clear();

    expect(localStorage.getItem('mfm_places')).toBeNull();
    expect(localStorage.getItem('mistermolkky_settings')).toBe(
      '{"theme":"sombre"}'
    );
  });
});
