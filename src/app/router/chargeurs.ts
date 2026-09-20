/**
 * UN CHARGEUR PAR PAGE, déclaré une seule fois.
 *
 * Deux endroits ont besoin du `() => import(…)` d'une page : le routeur, qui le
 * passe à `lazy()`, et la barre basse, qui le tend à `prefetch()` du socle dès
 * que le pointeur, le focus ou le doigt approche l'onglet. Écrit deux fois — le
 * même chemin dans deux fichiers —, c'était deux fonctions DISTINCTES. Vite
 * n'en faisait qu'un morceau, mais le `WeakSet` de `prefetch()` (« ce chargeur
 * est déjà parti ») ne pouvait pas relier ce que la barre avait préchauffé à ce
 * que `lazy()` allait demander ; et une divergence — une page renommée d'un
 * seul côté — aurait été silencieuse : le préchargement serait parti pour une
 * autre page sans qu'aucun test ne le voie.
 *
 * Les clés sont les noms des modules de `src/pages/` : `chargeurs.MapPage`
 * charge `pages/MapPage`. `chargeurs.test.tsx` tient l'identité — ce que la
 * barre précharge est, au sens de `===`, ce que le routeur passe à `lazy()`.
 */
export const chargeurs = {
  ExplorePage: () => import('../../pages/ExplorePage'),
  // Le plus lourd de tous : MapLibre GL pèse 989 ko avant compression.
  MapPage: () => import('../../pages/MapPage'),
  PlaceDetailPage: () => import('../../pages/PlaceDetailPage'),
  PlaceCreatePage: () => import('../../pages/PlaceCreatePage'),
  AgendaPage: () => import('../../pages/AgendaPage'),
  EventDetailPage: () => import('../../pages/EventDetailPage'),
  EventCreatePage: () => import('../../pages/EventCreatePage'),
  FavoritesPage: () => import('../../pages/FavoritesPage'),
  AuthPage: () => import('../../pages/AuthPage'),
  ProfilePage: () => import('../../pages/ProfilePage'),
  MyContributionsPage: () => import('../../pages/MyContributionsPage'),
  ModerationPage: () => import('../../pages/ModerationPage'),
  LegalPage: () => import('../../pages/LegalPage'),
  NotFoundPage: () => import('../../pages/NotFoundPage'),
};
