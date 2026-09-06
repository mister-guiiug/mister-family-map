import { useEffect } from 'react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import {
  CalendarDays,
  Compass,
  Heart,
  Map as MapIcon,
  UserRound,
} from 'lucide-react';
import { ConnectionBanner } from '@mister-guiiug/dev-pwa-config/react/connection-banner';
import { AppFooter } from '@mister-guiiug/dev-pwa-config/react/app-footer';
import { prefetch } from '@mister-guiiug/dev-pwa-config/prefetch';
import { startTabSync } from '../../shared/api/tab-sync';
import { UpdatePromptBanner } from '@mister-guiiug/dev-pwa-config/react/update-prompt-banner';
import { registerSW } from 'virtual:pwa-register';
import { useBackend } from '../providers/BackendProvider';
import { useAuthStore } from '../../features/auth/store';
import { useFavoritesStore } from '../../features/favorites/store';

/**
 * Chaque entrée porte le CHARGEUR de sa page, le même `() => import(…)` que le
 * routeur passe à `lazy()`. Le module n'est donc téléchargé qu'une fois : les
 * deux références pointent le même chemin, et Vite ne produit qu'un morceau.
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
    load: () => import('../../pages/ExplorePage'),
  },
  {
    to: '/carte',
    label: 'Carte',
    icon: MapIcon,
    end: false,
    // Le plus lourd de tous : MapLibre GL pèse 989 ko avant compression.
    load: () => import('../../pages/MapPage'),
  },
  {
    to: '/agenda',
    label: 'Agenda',
    icon: CalendarDays,
    end: false,
    load: () => import('../../pages/AgendaPage'),
  },
  {
    to: '/favoris',
    label: 'Favoris',
    icon: Heart,
    end: false,
    load: () => import('../../pages/FavoritesPage'),
  },
  {
    to: '/profil',
    label: 'Profil',
    icon: UserRound,
    end: false,
    load: () => import('../../pages/ProfilePage'),
  },
] as const;

/**
 * Shell mobile-first : contenu + navigation basse (5 entrées max, zone
 * pouce), safe-areas iOS, lien d'évitement, bannières hors-ligne et mise à
 * jour PWA (rechargement contrôlé par l'utilisateur).
 */
export function RootLayout() {
  const backend = useBackend();
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
      <UpdatePromptBanner registerSW={registerSW} snoozeHours={6} />

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

        {/*
          HORS des routes : le code source et « M'offrir un café » sont ainsi
          sur le premier écran comme sur le Profil — la règle famille du
          05/09/2026. Ils n'étaient que sur le Profil, via `FamilyApps`, qui
          garde son rôle propre : la grille des applications sœurs.

          DANS `<main>` à dessein : la navigation basse est `fixed`, et c'est
          le `pb-24` qui lui réserve sa place. Posé après `</main>`, ce pied de
          page passerait dessous.
        */}
        <AppFooter
          className="mt-8 justify-center px-fluid-md text-fluid-sm"
          repoUrl="https://github.com/mister-guiiug/mister-family-map"
        />
      </main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-safe-bottom"
      >
        <ul className="mx-auto flex max-w-xl justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, load }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
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
                    <Icon
                      size={22}
                      aria-hidden="true"
                      strokeWidth={isActive ? 2.4 : 1.8}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ScrollRestoration />
    </div>
  );
}
