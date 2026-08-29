/**
 * Deux onglets de la même app restent d'accord — sans serveur.
 *
 * LE DÉFAUT QUE ÇA CORRIGE. Le backend local écrit dans `localStorage`, que
 * tous les onglets partagent ; mais les stores React de chaque onglet gardent
 * leur copie en mémoire. Ajouter un favori dans un onglet ne changeait RIEN
 * dans l'autre avant un rechargement : deux vues de la même donnée, qui se
 * contredisent en silence.
 *
 * C'EST AUSSI UN BANC D'ESSAI. Le port temps réel du socle (`realtime/`) a
 * été conçu sans usage réel à généraliser — son en-tête l'assume. Le brancher
 * ici, sur le transport LOCAL (`BroadcastChannel`), l'éprouve en conditions
 * réelles avec le même contrat que les adaptateurs Supabase et Firestore : le
 * jour où l'app se synchronise entre appareils, seul le transport change.
 *
 * CE QUI EST ANNONCÉ : chaque mutation du backend local émet son sujet
 * (`favorites`, `places`, `events`, `reviews`, `session`). CE QUI EST ÉCOUTÉ
 * aujourd'hui : `favorites` et `session`, les deux états GLOBAUX (stores) ;
 * les pages qui chargent leurs listes à la demande réagiront quand elles
 * auront un cache à invalider — les annonces, elles, sont déjà là.
 */
import { createChannel } from '@mister-guiiug/dev-wpa-config/realtime';
import { localRealtimeTransport } from '@mister-guiiug/dev-wpa-config/realtime/local';

export type TabSyncTopic =
  'favorites' | 'places' | 'events' | 'reviews' | 'session';

interface TabSyncMessage {
  topic: TabSyncTopic;
}

const transport = localRealtimeTransport<TabSyncMessage>({ name: 'mfm' });

/** Annonce une mutation aux AUTRES onglets. Jamais à soi-même : l'onglet qui
 *  écrit a déjà mis son store à jour, le re-notifier ferait un double appel. */
export function announceTabChange(topic: TabSyncTopic): void {
  transport.post({ topic });
}

/**
 * Écoute les annonces des autres onglets. Rend l'arrêt.
 *
 * Le canal du socle apporte ce que `BroadcastChannel` seul n'a pas : l'état
 * observable, et la sonde au réveil de l'onglet — un onglet mobile suspendu
 * revient avec une connexion morte sans qu'aucun évènement ne l'ait dit.
 */
export function startTabSync(
  onTopic: (topic: TabSyncTopic) => void
): () => void {
  const channel = createChannel<TabSyncMessage>({
    connect: handlers => transport.connect(handlers),
    onMessage: message => {
      if (message?.topic) onTopic(message.topic);
    },
  });
  void channel.start();
  return () => channel.stop();
}
