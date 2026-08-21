import { Badge } from '@mister-guiiug/dev-wpa-config/react';
import type { TriState } from '../../../shared/types/tri-state';
import { TRI_STATE_LABELS } from '../../../shared/types/tri-state';

/**
 * Affiche un attribut ternaire sans jamais présenter l'inconnu comme un
 * « non » : trois rendus distincts, libellé complet pour les lecteurs d'écran.
 */
export function TriStateChip({
  label,
  value,
}: {
  label: string;
  value: TriState;
}) {
  const tone = value === 'yes' ? 'success' : value === 'no' ? 'muted' : 'info';
  return (
    <Badge tone={tone} variant="soft">
      <span>
        {label}
        {' : '}
        {TRI_STATE_LABELS[value].toLowerCase()}
      </span>
    </Badge>
  );
}
