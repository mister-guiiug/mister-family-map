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
 * ─────────────────────────────────────────────────────────────────────────
 * LE MESSAGE PORTE LA VALEUR. IL NE DIT PAS « VA VOIR ».
 *
 * C'est la règle de ce module, et elle est née d'un défaut MESURÉ, pas d'un
 * principe. Le message se contentait d'un sujet ; l'onglet qui le recevait
 * relisait `localStorage`. Or **rien n'ordonne l'écriture de l'onglet A et la
 * réception du message dans l'onglet B** : ce sont deux processus de rendu
 * distincts, et `BroadcastChannel` passe par le processus navigateur quand la
 * propagation du stockage suit son propre chemin. Sondé sur ce poste, l'onglet
 * receveur lisait `mfm_data` **ABSENT** au moment même où il traitait
 * l'annonce — une fois sur deux.
 *
 * Le défaut existait avant l'instantané versionné (ADR-0004) ; il était
 * seulement invisible, parce que la clé diffusée pesait vingt octets. Sous une
 * clé unique de ~11 ko, la fenêtre s'est ouverte assez large pour que l'E2E
 * multi-onglets la trouve une fois sur deux.
 *
 * Porter la valeur supprime la course au lieu de la rétrécir. C'est en outre
 * ce que font les VRAIS transports temps réel — `postgres_changes` de Supabase
 * livre la ligne, il ne dit pas « relis la table » : ce module s'en rapproche
 * au lieu de s'en éloigner. Cf. docs/adr/0007-le-message-porte-la-valeur.md.
 *
 * TOUT SUJET QUI GAGNE UN AUDITEUR DOIT DONC GAGNER SA VALEUR. Les trois
 * sujets sans auditeur (`places`, `events`, `reviews`) n'en portent pas encore
 * — le type ci-dessous est ce qui rend l'oubli impossible.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { createChannel } from '@mister-guiiug/dev-pwa-config/realtime';
import { localRealtimeTransport } from '@mister-guiiug/dev-pwa-config/realtime/local';
import type { AuthSession } from '../../entities/user/model';

/**
 * Ce qui circule entre onglets.
 *
 * Union DISCRIMINÉE, et non `{ topic, value?: unknown }` : le sujet qui a un
 * auditeur porte sa valeur, et le compilateur refuse de l'annoncer sans elle.
 *
 * Elle remplace l'ancien `TabSyncTopic`, qui n'était plus qu'un vocabulaire
 * de sujets sans charge — et n'avait plus d'importateur.
 */
export type TabSyncMessage =
  /** Les identifiants de favoris, tels qu'ils viennent d'être écrits. */
  | { topic: 'favorites'; ids: readonly string[] }
  /** La session après le changement — `null` après déconnexion. */
  | { topic: 'session'; session: AuthSession | null }
  /** Sans auditeur à ce jour : « quelque chose a changé », et rien de plus. */
  | { topic: 'places' | 'events' | 'reviews' };

const transport = localRealtimeTransport<TabSyncMessage>({ name: 'mfm' });

/** Annonce une mutation aux AUTRES onglets. Jamais à soi-même : l'onglet qui
 *  écrit a déjà mis son store à jour, le re-notifier ferait un double appel. */
export function announceTabChange(message: TabSyncMessage): void {
  transport.post(message);
}

/**
 * Écoute les annonces des autres onglets. Rend l'arrêt.
 *
 * Le canal du socle apporte ce que `BroadcastChannel` seul n'a pas : l'état
 * observable, et la sonde au réveil de l'onglet — un onglet mobile suspendu
 * revient avec une connexion morte sans qu'aucun évènement ne l'ait dit.
 */
export function startTabSync(
  onMessage: (message: TabSyncMessage) => void
): () => void {
  const channel = createChannel<TabSyncMessage>({
    connect: handlers => transport.connect(handlers),
    onMessage: message => {
      if (message?.topic) onMessage(message);
    },
  });
  void channel.start();
  return () => channel.stop();
}
