import { useEffect } from 'react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import {
  CalendarDays,
  Compass,
  Heart,
  Map as MapIcon,
  UserRound,
} from 'lucide-react';
import { useOnline } from '@mister-guiiug/dev-wpa-config/react';
import { UpdatePromptBanner } from '@mister-guiiug/dev-wpa-config/react/update-prompt-banner';
import { registerSW } from 'virtual:pwa-register';
import { useBackend } from '../providers/BackendProvider';
import { useAuthStore } from '../../features/auth/store';
import { useFavoritesStore } from '../../features/favorites/store';

const NAV_ITEMS = [
  { to: '/', label: 'Explorer', icon: Compass, end: true },
  { to: '/carte', label: 'Carte', icon: MapIcon, end: false },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, end: false },
  { to: '/favoris', label: 'Favoris', icon: Heart, end: false },
  { to: '/profil', label: 'Profil', icon: UserRound, end: false },
] as const;

/**
 * Shell mobile-first : contenu + navigation basse (5 entrées max, zone
 * pouce), safe-areas iOS, lien d'évitement, bannières hors-ligne et mise à
 * jour PWA (rechargement contrôlé par l'utilisateur).
 */
export function RootLayout() {
  const backend = useBackend();
  const online = useOnline();
  const initAuth = useAuthStore(s => s.init);
  const loadFavorites = useFavoritesStore(s => s.load);

  useEffect(() => {
    void initAuth(backend.auth);
    void loadFavorites(backend.favorites);
  }, [backend, initAuth, loadFavorites]);

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

      {!online ? (
        <p
          role="status"
          className="bg-surface-2 px-fluid-md py-2 text-center text-fluid-sm"
        >
          Hors ligne — vos favoris et les fiches déjà consultées restent
          disponibles.
        </p>
      ) : null}

      <main id="contenu" className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-safe-bottom"
      >
        <ul className="mx-auto flex max-w-xl justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
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
