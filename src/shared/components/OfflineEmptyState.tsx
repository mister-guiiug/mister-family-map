import { EmptyState } from '@mister-guiiug/dev-pwa-config/react';

/**
 * Une liste que le réseau n'a pas encore livrée, HORS LIGNE — à la place du
 * squelette.
 *
 * Avec Supabase, rien n'est gardé sur l'appareil : hors ligne, la lecture
 * échoue, et Query met ses nouvelles tentatives en PAUSE jusqu'au retour du
 * réseau (`isPaused`). Un squelette dit « ça charge » ; ici, rien ne
 * chargera avant le réseau, et l'écran le dit. Pas de bouton « Réessayer » :
 * la requête repart seule quand le réseau revient.
 */
export function OfflineEmptyState({ what }: { what: string }) {
  return (
    <EmptyState
      title="Hors ligne"
      description={`${what} se chargeront au retour du réseau.`}
    />
  );
}
