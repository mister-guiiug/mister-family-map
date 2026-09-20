import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ToastProvider } from '@mister-guiiug/dev-pwa-config/react/toast';
import { useUndoToast } from './useUndoToast';

/**
 * CE QUE CE TEST TIENT.
 *
 * « Annuler » n'est utile que s'il est là, dans le message, à portée de pouce,
 * pendant quelques secondes — sinon il faut un dialogue de confirmation AVANT
 * chaque geste, c'est-à-dire faire payer à chaque suppression volontaire le
 * prix des rares suppressions par erreur (ADR-0005).
 *
 * LE BOUTON EST CELUI DU SOCLE depuis la 4.5.0 (`show(message, { action })`,
 * `[data-dwc='toast-action']`) ; ce dépôt ne le construit plus. Les propriétés
 * tenues sont les mêmes qu'avant — c'est le COMPORTEMENT qui est verrouillé,
 * pas qui rend le bouton :
 *  1. l'action EXISTE, et c'est un vrai bouton (clavier, lecteur d'écran) ;
 *  2. l'appuyer défait, et referme la notification tout de suite — sans quoi
 *     l'utilisateur peut annuler deux fois ;
 *  3. ne rien faire NE défait pas : la notification part seule au bout du
 *     délai, et la suppression tient ;
 *  4. le délai laisse le temps de lire ET d'atteindre le bouton : huit
 *     secondes, le plancher du socle pour un toast à action ;
 *  5. une seconde suppression REMPLACE la première notification.
 *
 * Le jour où le socle ramènerait ce plancher à cinq secondes, ou cesserait de
 * refermer au clic, c'est ICI que ça se verrait.
 */

// `Ecran` sans accent : `react-hooks/rules-of-hooks` reconnaît un composant à
// son initiale `[A-Z]` au sens ASCII, et refuse `É` — un `useToast` appelé là
// serait alors signalé comme un appel de hook hors composant.
function Ecran({ onUndo }: { onUndo: () => void }) {
  const showUndo = useUndoToast();
  return (
    <button
      type="button"
      onClick={() =>
        showUndo({ message: 'Lieu supprimé', onUndo, id: 'undo-lieu' })
      }
    >
      Supprimer
    </button>
  );
}

function monter(onUndo: () => void) {
  render(
    <ToastProvider>
      <Ecran onUndo={onUndo} />
    </ToastProvider>
  );
}

function supprimer() {
  act(() => {
    screen.getByRole('button', { name: 'Supprimer' }).click();
  });
}

describe('annuler depuis la notification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche le message ET le bouton « Annuler » — celui du socle', () => {
    monter(() => {});
    supprimer();

    expect(screen.getByText('Lieu supprimé')).toBeInTheDocument();
    const annuler = screen.getByRole('button', { name: 'Annuler' });
    expect(annuler).toBeInTheDocument();
    // Rendu par le socle, pas par ce dépôt : c'est l'adoption qui est tenue.
    expect(annuler).toHaveAttribute('data-dwc', 'toast-action');
  });

  it('annule et referme la notification', () => {
    const onUndo = vi.fn();
    monter(onUndo);
    supprimer();

    act(() => {
      screen.getByRole('button', { name: 'Annuler' }).click();
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    // Refermée tout de suite : impossible d'annuler deux fois.
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
  });

  it('s’efface seule après le délai, SANS annuler', () => {
    const onUndo = vi.fn();
    monter(onUndo);
    supprimer();

    // Huit secondes, écrites EN CLAIR : le plancher du socle pour un toast à
    // action, pas une constante de l'app relue ici.
    act(() => {
      vi.advanceTimersByTime(7900);
    });
    expect(screen.getByText('Lieu supprimé')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Lieu supprimé')).toBeNull();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('laisse le temps de lire ET d’atteindre le bouton', () => {
    // Cinq secondes (l'ordinaire du socle) suffisent à LIRE ; elles ne
    // suffisent pas à comprendre qu'on s'est trompé, à viser et à appuyer.
    // La durée est écrite EN CLAIR : un test qui comparerait une constante à
    // elle-même passerait encore le jour où quelqu'un la ramène à cinq.
    monter(() => {});
    supprimer();

    act(() => {
      vi.advanceTimersByTime(7900);
    });

    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  it('une seconde suppression remplace la première notification', () => {
    // Sans identifiant stable, deux suppressions rapides empilent deux
    // « Annuler » identiques et l'utilisateur ne sait plus lequel défait quoi.
    monter(() => {});
    supprimer();
    supprimer();

    expect(screen.getAllByRole('button', { name: 'Annuler' })).toHaveLength(1);
  });
});
