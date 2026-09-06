import { useCallback } from 'react';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { newId } from '../lib/id';

/**
 * « Supprimé · Annuler », quelques secondes, dans la notification.
 *
 * POURQUOI CE FICHIER EXISTE. Le `toast` du socle n'a pas d'action : un
 * message, une croix, c'est tout. L'action est donc écrite ici, dans l'app, en
 * profitant de ce que le socle accepte déjà — le message est un `ReactNode`, et
 * une notification peut porter un identifiant STABLE, ce qui donne de quoi la
 * refermer depuis l'intérieur.
 *
 * POURQUOI PAS UN DIALOGUE DE CONFIRMATION. « Êtes-vous sûr ? » fait payer à
 * chaque suppression volontaire — la quasi-totalité — le prix des rares
 * suppressions par erreur, et on apprend à répondre « oui » sans lire. Annuler
 * après coup inverse le marché : le geste courant est gratuit, et le geste
 * regretté se rattrape. Cf. docs/adr/0005-annuler-plutot-que-confirmer.md.
 */

/**
 * Huit secondes, pas cinq (le défaut du socle).
 *
 * Cinq suffisent à LIRE une notification ; elles ne suffisent pas à réaliser
 * qu'on s'est trompé, à trouver le bouton et à l'atteindre au pouce. Le socle
 * suspend en plus le compte à rebours tant que le doigt ou le focus est sur la
 * pile (WCAG 2.2.1) : le délai est un plancher, pas un couperet.
 */
export const UNDO_MS = 8000;

export interface UndoRequest {
  /** Ce qui vient de se passer, au passé : « Lieu supprimé ». */
  message: string;
  /** Défait le geste. Les erreurs sont à la charge de l'appelant. */
  onUndo: () => void | Promise<void>;
  /**
   * Identifiant STABLE de la notification. Deux suppressions rapides
   * empileraient sinon deux « Annuler » identiques, sans dire lequel défait
   * quoi : le même identifiant fait que la seconde remplace la première.
   */
  id?: string;
  durationMs?: number;
}

/** Rend `showUndo` : notifie, et propose de défaire. */
export function useUndoToast(): (request: UndoRequest) => void {
  const toast = useToast();

  return useCallback(
    ({ message, onUndo, id, durationMs = UNDO_MS }: UndoRequest) => {
      const toastId = id ?? `undo-${newId()}`;
      toast.show(
        <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
          <span>{message}</span>
          {/*
            Un VRAI bouton : atteignable au clavier, annoncé comme tel, et
            dimensionné à la cible tactile de la famille (`touch-target`).
          */}
          <button
            type="button"
            className="touch-target -my-2 rounded-(--radius-card) px-2 font-semibold text-primary underline"
            onClick={() => {
              // Refermer D'ABORD : sans cela, un double appui annule deux fois.
              toast.dismiss(toastId);
              void onUndo();
            }}
          >
            Annuler
          </button>
        </span>,
        { id: toastId, duration: durationMs }
      );
    },
    [toast]
  );
}
