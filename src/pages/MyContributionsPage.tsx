import { Link } from 'react-router';
import {
  Badge,
  EmptyState,
  SkeletonGroup,
} from '@mister-guiiug/dev-wpa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import { useAuthStore } from '../features/auth/store';
import {
  PUBLICATION_STATUS_LABELS,
  PUBLICATION_STATUSES,
} from '../entities/place/model';
import { PageHeader } from '../shared/components/PageHeader';
import { getDefaultLocale } from '@mister-guiiug/dev-wpa-config/format';

/** Suivi des contributions de l'utilisateur, avec leur statut de validation. */
export default function MyContributionsPage() {
  const backend = useBackend();
  const session = useAuthStore(s => s.session);

  const placesState = useAsync(
    () =>
      session
        ? backend.places.list({
            authorId: session.userId,
            statuses: PUBLICATION_STATUSES,
          })
        : Promise.resolve([]),
    session?.userId ?? 'anon'
  );
  const reviewsState = useAsync(
    () =>
      session
        ? backend.reviews.listByAuthor(session.userId)
        : Promise.resolve([]),
    session?.userId ?? 'anon'
  );

  if (!session) {
    return (
      <div>
        <PageHeader title="Mes contributions" />
        <p className="px-fluid-md text-fluid-sm">
          <Link to="/connexion" className="underline">
            Connectez-vous
          </Link>{' '}
          pour retrouver vos contributions.
        </p>
      </div>
    );
  }

  const statusTone = (status: keyof typeof PUBLICATION_STATUS_LABELS) =>
    status === 'published'
      ? ('success' as const)
      : status === 'pending'
        ? ('warning' as const)
        : status === 'draft'
          ? ('muted' as const)
          : ('danger' as const);

  return (
    <div>
      <PageHeader
        title="Mes contributions"
        subtitle="Lieux proposés et retours publiés"
      />
      <div className="flex flex-col gap-5 px-fluid-md pb-8">
        <section aria-label="Mes lieux">
          <h2 className="mb-2 text-fluid-lg font-semibold">Lieux proposés</h2>
          {placesState.loading ? (
            <SkeletonGroup label="Chargement" lines={2} />
          ) : (placesState.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Aucun lieu proposé"
              description="Votre premier lieu aidera toutes les familles du coin."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {placesState.data?.map(place => (
                <li
                  key={place.id}
                  className="flex items-center justify-between gap-2 rounded-(--radius-card) border border-line p-fluid-sm text-fluid-sm"
                >
                  <Link to={`/lieux/${place.id}`} className="underline">
                    {place.name}
                  </Link>
                  <Badge tone={statusTone(place.status)}>
                    {PUBLICATION_STATUS_LABELS[place.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Mes retours">
          <h2 className="mb-2 text-fluid-lg font-semibold">
            Retours d’expérience
          </h2>
          {reviewsState.loading ? (
            <SkeletonGroup label="Chargement" lines={2} />
          ) : (reviewsState.data?.length ?? 0) === 0 ? (
            <p className="text-fluid-sm text-ink-soft">
              Aucun retour publié pour l’instant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-fluid-sm">
              {reviewsState.data?.map(review => (
                <li
                  key={review.id}
                  className="rounded-(--radius-card) border border-line p-fluid-sm"
                >
                  <Link to={`/lieux/${review.placeId}`} className="underline">
                    Visite du{' '}
                    {new Date(review.visitedOn).toLocaleDateString(
                      getDefaultLocale()
                    )}
                  </Link>{' '}
                  — {review.rating}/5
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
