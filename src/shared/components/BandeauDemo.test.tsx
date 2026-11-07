import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BandeauDemo } from './BandeauDemo';

const CLE = 'mfm_bandeau_demo_replie';

function renderBandeau() {
  return render(
    <BandeauDemo
      etiquette="Démonstration"
      message="Ce que vous ajoutez reste dans ce navigateur, rien n’est partagé."
      cleStockage={CLE}
    />
  );
}

describe('BandeauDemo', () => {
  beforeEach(() => localStorage.clear());

  it('dit la démonstration, déplié par défaut', () => {
    renderBandeau();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Démonstration' +
        'Ce que vous ajoutez reste dans ce navigateur, rien n’est partagé.'
    );
    expect(
      screen.getByRole('button', { name: 'Démonstration' })
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('se replie sans disparaître : l’étiquette reste, la phrase revient d’un appui', async () => {
    renderBandeau();
    const bascule = screen.getByRole('button', { name: 'Démonstration' });
    await userEvent.click(bascule);
    expect(bascule).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('note')).toHaveTextContent(/^Démonstration$/);

    await userEvent.click(bascule);
    expect(bascule).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('note')).toHaveTextContent(/rien n’est partagé/);
  });

  it('retient le repli d’un montage à l’autre, sous SA clé préfixée', async () => {
    const { unmount } = renderBandeau();
    await userEvent.click(
      screen.getByRole('button', { name: 'Démonstration' })
    );
    expect(localStorage.getItem(CLE)).toBe('true');
    unmount();

    renderBandeau();
    expect(
      screen.getByRole('button', { name: 'Démonstration' })
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
