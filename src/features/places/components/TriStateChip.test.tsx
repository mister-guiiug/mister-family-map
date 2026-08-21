import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TriStateChip } from './TriStateChip';

describe('TriStateChip', () => {
  it('présente l’inconnu comme « information inconnue », jamais comme un non', () => {
    render(<TriStateChip label="Poussette" value="unknown" />);
    expect(
      screen.getByText('Poussette : information inconnue')
    ).toBeInTheDocument();
  });

  it('affiche oui et non distinctement', () => {
    render(<TriStateChip label="Toilettes" value="yes" />);
    expect(screen.getByText('Toilettes : oui')).toBeInTheDocument();
  });
});
