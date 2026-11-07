import { useBackend } from '../../app/providers/BackendProvider';

/** Ce que le bandeau de démonstration dit, sur la carte comme à la connexion. */
export const MESSAGE_DEMO =
  'Ce que vous ajoutez reste dans ce navigateur, rien n’est partagé.';

/** Où le bandeau retient qu'on l'a replié — préfixe `mfm_` de l'app. */
export const CLE_BANDEAU_DEMO = 'mfm_bandeau_demo_replie';

/**
 * L'application tourne-t-elle en DÉMONSTRATION — c'est-à-dire sans rien
 * partager ?
 *
 * C'est le dépôt des lieux qui le dit : l'adaptateur local écrit dans le
 * navigateur (`requiresNetwork: false`), l'adaptateur Supabase sur le serveur.
 * Le site publié n'a pas de Supabase : il est toujours dans le premier cas.
 *
 * CE QUE CE DRAPEAU NE COUVRE PAS. Avec Supabase, seuls les lieux sont
 * aujourd'hui branchés (« migration port par port », README) : avis,
 * événements, favoris et session restent locaux. Ce mode n'est déployé nulle
 * part ; ses textes seront à revoir quand les autres ports suivront.
 */
export function useModeDemo(): boolean {
  return !useBackend().places.requiresNetwork;
}
