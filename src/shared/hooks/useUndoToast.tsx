import { useCallback } from 'react';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';

/**
 * « Supprimé · Annuler », quelques secondes, dans la notification.
 *
 * LE BOUTON EST CELUI DU SOCLE. Ce fichier a d'abord construit son propre
 * bouton dans le message — le toast du socle n'avait alors aucune notion
 * d'action, et l'ADR-0005 le disait : « brouillon local de cette pièce-là, à
 * remonter ». Elle est remontée. Depuis la 4.5.0, `show(message, { action })`
 * rend un vrai `<button>` DANS le message (`[data-dwc='toast-action']`,
 * habillé par `components.css` : cible tactile de 2,75 rem, texte souligné),
 * libellé « Annuler » dans les sept langues de `labels` (`toast.undo`), qui
 * agit PUIS referme la notification dans le même geste — on n'annule pas deux
 * fois. Le focus qui s'y pose suspend le rebours (WCAG 2.2.1).
 *
 * LA DURÉE EST UN PLANCHER DU SOCLE. Un toast porteur d'une action vit huit
 * secondes au moins — lire, décider, puis atteindre le bouton ne tient pas
 * dans les cinq de l'ordinaire —, et un fournisseur réglé plus haut garde sa
 * valeur. Ce fichier ne porte donc plus `UNDO_MS` : c'est la même mesure
 * qu'avant, décidée à un seul endroit. `durationMs` reste pour qui voudrait
 * autre chose, et la durée redevient alors la responsabilité de l'appelant.
 *
 * Il ne reste ici que le vocabulaire de l'app — ce qui vient de se passer,
 * comment le défaire — et l'identifiant qui fait qu'une seconde suppression
 * REMPLACE la première notification au lieu d'empiler deux « Annuler »
 * indiscernables.
 *
 * POURQUOI PAS UN DIALOGUE DE CONFIRMATION. « Êtes-vous sûr ? » fait payer à
 * chaque suppression volontaire — la quasi-totalité — le prix des rares
 * suppressions par erreur, et on apprend à répondre « oui » sans lire. Annuler
 * après coup inverse le marché : le geste courant est gratuit, et le geste
 * regretté se rattrape. Cf. docs/adr/0005-annuler-plutot-que-confirmer.md.
 */

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
  /**
   * Sans valeur : le plancher du socle pour un toast à action (8 s), ou la
   * durée du fournisseur si elle est plus longue.
   */
  durationMs?: number;
}

/** Rend `showUndo` : notifie, et propose de défaire. */
export function useUndoToast(): (request: UndoRequest) => void {
  const toast = useToast();

  return useCallback(
    ({ message, onUndo, id, durationMs }: UndoRequest) => {
      toast.show(message, {
        id,
        duration: durationMs,
        // Le socle referme la notification dans le même geste que l'action.
        action: { onAction: () => void onUndo() },
      });
    },
    [toast]
  );
}
