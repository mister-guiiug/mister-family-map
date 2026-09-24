import {
  useEffect,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from 'react-router';
import { ConsentBanner } from '@mister-guiiug/dev-pwa-config/react/consent-banner';
import { usePageViews } from '@mister-guiiug/dev-pwa-config/react/use-page-views';
import {
  CalendarDays,
  Compass,
  Heart,
  LoaderCircle,
  Map as MapIcon,
  UserRound,
} from 'lucide-react';
import { ConnectionBanner } from '@mister-guiiug/dev-pwa-config/react/connection-banner';
import { prefetch } from '@mister-guiiug/dev-pwa-config/prefetch';
import { startTabSync } from '../../shared/api/tab-sync';
import { UpdatePromptBanner } from '@mister-guiiug/dev-pwa-config/react/update-prompt-banner';
import { registerSW } from 'virtual:pwa-register';
import { useBackend } from '../providers/BackendProvider';
import { useAuthStore } from '../../features/auth/store';
import { useFavoritesStore } from '../../features/favorites/store';
import { chargeurs } from '../router/chargeurs';

/**
 * Chaque entrée porte le CHARGEUR de sa page — LE MÊME objet que le routeur
 * passe à `lazy()`, pris dans `router/chargeurs.ts`. Pas une copie du même
 * `() => import(…)` : le `WeakSet` de `prefetch()` ne relierait pas deux
 * fonctions distinctes, et une page renommée d'un seul côté préchargerait la
 * mauvaise sans qu'aucun test ne le voie. `chargeurs.test.tsx` tient l'identité.
 *
 * POURQUOI. Le service worker précache tous les morceaux — mais à partir de la
 * DEUXIÈME visite seulement. À la première, celle qui décide si la famille
 * revient, ouvrir « Carte » ou « Agenda » attend le réseau derrière un
 * squelette. Ici on charge le morceau quand le doigt se pose sur l'onglet,
 * quelques dizaines de millisecondes avant le relâchement.
 */
const NAV_ITEMS = [
  {
    to: '/',
    label: 'Explorer',
    icon: Compass,
    end: true,
    load: chargeurs.ExplorePage,
  },
  {
    to: '/carte',
    label: 'Carte',
    icon: MapIcon,
    end: false,
    // Le plus lourd de tous : MapLibre GL pèse 989 ko avant compression.
    load: chargeurs.MapPage,
  },
  {
    to: '/agenda',
    label: 'Agenda',
    icon: CalendarDays,
    end: false,
    load: chargeurs.AgendaPage,
  },
  {
    to: '/favoris',
    label: 'Favoris',
    icon: Heart,
    end: false,
    load: chargeurs.FavoritesPage,
  },
  {
    to: '/profil',
    label: 'Profil',
    icon: UserRound,
    end: false,
    load: chargeurs.ProfilePage,
  },
] as const;

/**
 * Shell mobile-first : contenu + navigation basse (5 entrées max, zone
 * pouce), safe-areas iOS, lien d'évitement, bannières hors-ligne et mise à
 * jour PWA (rechargement contrôlé par l'utilisateur).
 */
export function RootLayout() {
  const backend = useBackend();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  /*
   * LE PRÉCHARGEMENT NE SUFFIT PAS, ET C'EST MESURÉ.
   *
   * Les trois écouteurs d'intention posés sur chaque onglet — `pointerenter`,
   * `focus`, `touchstart` — donnent de l'avance quand il y en a une à prendre. Mais un doigt qui se pose et relâche aussitôt, ou un
   * lien à 280 ko compressés — MapLibre GL — ne laissent pas ce répit. Le clic
   * restait alors MUET : relevé le 20/09/2026 sur cette application, à 8 ms
   * l'adresse disait déjà `/agenda` pendant que l'écran affichait encore
   * « Explorer », et le `SkeletonGroup` « Chargement de la page » du routeur
   * n'est JAMAIS apparu — le nombre de zones vives n'a pas bougé de 1.
   *
   * Il ne pouvait pas. react-router enveloppe tout changement d'URL dans
   * `startTransition`, et React 19 garde délibérément l'écran déjà affiché
   * plutôt que de le remplacer par un repli. La frontière `Suspense` que pose
   * `page()` est RÉUTILISÉE d'une route à l'autre, jamais remontée : son
   * squelette ne se voit donc que sur un atterrissage direct.
   *
   * En pilotant `navigate` depuis notre propre transition, `enCours` reste vrai
   * tant que le morceau n'est pas là — la seule information qui manquait pour
   * répondre au doigt.
   */
  const [enCours, demarre] = useTransition();
  const [cible, setCible] = useState<string | null>(null);

  const versLOnglet = (e: ReactMouseEvent<HTMLAnchorElement>, to: string) => {
    // On laisse le navigateur faire son travail quand on le lui demande :
    // nouvel onglet, nouvelle fenêtre, enregistrement de la cible.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    setCible(to);
    demarre(() => navigate(to));
  };

  /*
   * UNE VUE DE PAGE PAR NAVIGATION — ni zéro, ni deux. `initAnalytics` pose
   * `capture_pageview: false` pour que toutes passent par ce hook, la première
   * comprise : laissé à lui-même, PostHog en envoie une au chargement ET à
   * chaque changement d'historique, et l'écran d'entrée serait compté deux
   * fois. Sans le hook, à l'inverse, toute la navigation serait invisible.
   *
   * Ne fait rien tant que le consentement n'est pas accordé.
   */
  usePageViews(pathname);
  const initAuth = useAuthStore(s => s.init);
  const loadFavorites = useFavoritesStore(s => s.load);
  const setFavoriteIds = useFavoritesStore(s => s.setIds);

  useEffect(() => {
    void initAuth(backend.auth);
    void loadFavorites(backend.favorites);

    // Deux onglets restent d'accord : quand l'autre annonce une mutation,
    // celui-ci pose la valeur PORTÉE PAR LE MESSAGE dans ses états globaux.
    //
    // Il RELISAIT le stockage partagé, et c'était faux : rien n'ordonne
    // l'écriture de l'autre onglet et l'arrivée du message ici. Sondé, cet
    // onglet lisait la clé ABSENTE au moment même où il traitait l'annonce —
    // une fois sur deux (en-tête de `tab-sync.ts`, ADR-0007).
    //
    // Les listes chargées à la demande par les pages ne sont pas concernées —
    // elles relisent à la navigation.
    return startTabSync(message => {
      if (message.topic === 'favorites') setFavoriteIds(message.ids);
      if (message.topic === 'session') {
        useAuthStore.getState().setSession(message.session);
      }
    });
  }, [backend, initAuth, loadFavorites, setFavoriteIds]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>

      {/*
        `registerSW` est ce qui fait EXISTER le bandeau. Sans lui, le socle
        n'a personne pour lui annoncer qu'un worker attend : `needRefresh`
        reste faux et le bandeau ne s'affiche jamais — monté, mais muet. Le
        module `virtual:pwa-register` n'existe que dans un build Vite, d'où
        l'injection plutôt qu'un import en dur côté paquet.
      */}
      <UpdatePromptBanner
        checkEvery="1h"
        registerSW={registerSW}
        snoozeHours={6}
      />

      {/*
        LE DÉFAUT CORRIGÉ ICI. Le bandeau précédent lisait `useOnline` SANS
        TEMPORISATION : un tunnel, un ascenseur, un changement d'antenne — et
        il s'allumait puis s'éteignait en une demi-seconde. Un signal qui
        clignote n'est plus un signal, c'est un parasite : on apprend à ne
        plus le regarder, et le jour où la coupure est vraie on ne le voit
        pas non plus. Le composant du paquet attend 1,5 s de coupure CONTINUE
        avant de parler.

        Le texte reste celui de l'app : « hors ligne » ne dit pas ce qui
        marche encore, et c'est la seule chose que la famille veut savoir.
      */}
      <ConnectionBanner
        className="mx-fluid-md mt-2"
        label="Hors ligne — vos favoris et les fiches déjà consultées restent disponibles."
      />

      <main id="contenu" className="flex-1 pb-24">
        <Outlet />

        {/* PAS DE PIED DE PAGE ICI : la règle famille (06/09/2026) le veut sur
            l'accueil (ExplorePage) et le Profil seulement. Sous toutes les
            routes, il suivait la fiche d'un lieu et la saisie d'un
            événement. */}
        {/* Une `region`, pas une boîte modale : elle ne recouvre rien et ne
            piège pas le focus. Ne rend RIEN tant que
            `VITE_POSTHOG_KEY` n'est pas posée — sans identifiant, il
            n'y a rien à mesurer, donc rien à demander. */}
        <ConsentBanner
          posthogKey={import.meta.env.VITE_POSTHOG_KEY}
          loader={() => import('posthog-js/dist/module.slim.js')}
          className="mt-8 px-fluid-md"
        />
      </main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-safe-bottom"
      >
        <ul className="mx-auto flex max-w-xl justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, load }) => {
            const charge = enCours && cible === to;
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={end}
                  onClick={e => versLOnglet(e, to)}
                  aria-busy={charge || undefined}
                  // Trois évènements, pas un : `focus` pour le clavier, qui
                  // mérite le même confort que la souris. Le socle déduplique et
                  // se coupe seul sur `saveData` et en 2G.
                  onPointerEnter={() => prefetch(load)}
                  onFocus={() => prefetch(load)}
                  onTouchStart={() => prefetch(load)}
                  className={({ isActive }) =>
                    `flex touch-target flex-col items-center gap-0.5 py-2 text-fluid-xs ${
                      isActive ? 'font-semibold text-primary' : 'text-ink-soft'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* L'onglet touché tourne le temps que son morceau
                        arrive. C'est le seul retour possible : le repli du
                        routeur ne paraîtra pas, React 19 gardant l'écran
                        courant pendant la transition. */}
                      {charge ? (
                        <LoaderCircle
                          size={22}
                          aria-hidden="true"
                          strokeWidth={2.4}
                          className="animate-spin"
                        />
                      ) : (
                        <Icon
                          size={22}
                          aria-hidden="true"
                          strokeWidth={isActive ? 2.4 : 1.8}
                        />
                      )}
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* HORS des liens, pour ne pas changer leur nom accessible en cours de
            route : qui ne voit pas la pastille tourner l'entend. */}
        <span className="sr-only" role="status" aria-live="polite">
          {enCours ? 'Chargement de la page…' : ''}
        </span>
      </nav>
      <ScrollRestoration />
    </div>
  );
}
