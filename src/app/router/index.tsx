import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react';
import { RootLayout } from '../layouts/RootLayout';
import { chargeurs } from './chargeurs';

/**
 * Pages en lazy-loading : le shell reste léger, la carte (MapLibre GL) n'est
 * chargée qu'à l'usage. Les chargeurs viennent de `chargeurs.ts` : ce sont LES
 * MÊMES objets que la barre basse tend à `prefetch()`.
 */
const ExplorePage = lazy(chargeurs.ExplorePage);
const MapPage = lazy(chargeurs.MapPage);
const PlaceDetailPage = lazy(chargeurs.PlaceDetailPage);
const PlaceCreatePage = lazy(chargeurs.PlaceCreatePage);
const AgendaPage = lazy(chargeurs.AgendaPage);
const EventDetailPage = lazy(chargeurs.EventDetailPage);
const EventCreatePage = lazy(chargeurs.EventCreatePage);
const FavoritesPage = lazy(chargeurs.FavoritesPage);
const AuthPage = lazy(chargeurs.AuthPage);
const ProfilePage = lazy(chargeurs.ProfilePage);
const MyContributionsPage = lazy(chargeurs.MyContributionsPage);
const ModerationPage = lazy(chargeurs.ModerationPage);
const LegalPage = lazy(chargeurs.LegalPage);
const NotFoundPage = lazy(chargeurs.NotFoundPage);

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
