import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { SkeletonGroup } from '@mister-guiiug/dev-wpa-config/react';
import { RootLayout } from '../layouts/RootLayout';

/** Pages en lazy-loading : le shell reste léger, la carte (Leaflet) n'est chargée qu'à l'usage. */
const ExplorePage = lazy(() => import('../../pages/ExplorePage'));
const MapPage = lazy(() => import('../../pages/MapPage'));
const PlaceDetailPage = lazy(() => import('../../pages/PlaceDetailPage'));
const PlaceCreatePage = lazy(() => import('../../pages/PlaceCreatePage'));
const AgendaPage = lazy(() => import('../../pages/AgendaPage'));
const EventDetailPage = lazy(() => import('../../pages/EventDetailPage'));
const EventCreatePage = lazy(() => import('../../pages/EventCreatePage'));
const FavoritesPage = lazy(() => import('../../pages/FavoritesPage'));
const AuthPage = lazy(() => import('../../pages/AuthPage'));
const ProfilePage = lazy(() => import('../../pages/ProfilePage'));
const MyContributionsPage = lazy(
  () => import('../../pages/MyContributionsPage')
);
const ModerationPage = lazy(() => import('../../pages/ModerationPage'));
const LegalPage = lazy(() => import('../../pages/LegalPage'));
const NotFoundPage = lazy(() => import('../../pages/NotFoundPage'));

function page(node: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="p-fluid-md">
          <SkeletonGroup label="Chargement de la page" lines={4} />
        </div>
      }
    >
      {node}
    </Suspense>
  );
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <RootLayout />,
      children: [
        { index: true, element: page(<ExplorePage />) },
        { path: 'carte', element: page(<MapPage />) },
        { path: 'lieux/nouveau', element: page(<PlaceCreatePage />) },
        { path: 'lieux/:id', element: page(<PlaceDetailPage />) },
        { path: 'agenda', element: page(<AgendaPage />) },
        { path: 'agenda/nouveau', element: page(<EventCreatePage />) },
        { path: 'agenda/:id', element: page(<EventDetailPage />) },
        { path: 'favoris', element: page(<FavoritesPage />) },
        { path: 'connexion', element: page(<AuthPage />) },
        { path: 'profil', element: page(<ProfilePage />) },
        {
          path: 'profil/contributions',
          element: page(<MyContributionsPage />),
        },
        { path: 'moderation', element: page(<ModerationPage />) },
        { path: 'mentions', element: page(<LegalPage />) },
        { path: '*', element: page(<NotFoundPage />) },
      ],
    },
  ],
  {
    // GitHub Pages sert l'app sous /<repo>/ — VITE_BASE_PATH via pwa-deploy.
    basename: import.meta.env.BASE_URL,
  }
);
