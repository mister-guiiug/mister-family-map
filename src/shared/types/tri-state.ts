/**
 * État ternaire des attributs collaboratifs : une donnée absente n'est PAS une
 * donnée négative. Un filtre « poussette » ne doit jamais exclure un lieu dont
 * la compatibilité poussette est simplement inconnue.
 */
export type TriState = 'yes' | 'no' | 'unknown';

export const TRI_STATE_VALUES = ['yes', 'no', 'unknown'] as const;

export const TRI_STATE_LABELS: Record<TriState, string> = {
  yes: 'Oui',
  no: 'Non',
  unknown: 'Information inconnue',
};

/**
 * Sémantique de filtre : demander `yes` garde les lieux `yes` ET `unknown`
 * (l'inconnu n'est pas éliminatoire) ; demander `no` est strict.
 */
export function matchesTriStateFilter(
  value: TriState,
  wanted: TriState | undefined
): boolean {
  if (wanted === undefined) return true;
  if (wanted === 'yes') return value !== 'no';
  return value === wanted;
}
