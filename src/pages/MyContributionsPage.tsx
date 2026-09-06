import { Link } from 'react-router';
import {
  Badge,
  Button,
  EmptyState,
  SkeletonGroup,
} from '@mister-guiiug/dev-pwa-config/react';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import { useUndoToast } from '../shared/hooks/useUndoToast';
import { useAuthStore } from '../features/auth/store';
import {
  PUBLICATION_STATUS_LABELS,
  PUBLICATION_STATUSES,
} from '../entities/place/model';
import { EVENT_STATUSES } from '../entities/event/model';
import { PageHeader } from '../shared/components/PageHeader';
import { getDefaultLocale } from '@mister-guiiug/dev-pwa-config/format';

/**
 * Suivi des contributions de l'utilisateur, avec leur statut de validation —
 * ET, depuis V12, le moyen de les retirer, puis de se rattraper.
 *
 * CE QUI MANQUAIT. `deletedAt` est dans le modèle depuis le premier jour, les
 * lectures le filtrent partout, la base n'a AUCUNE politique DELETE — et rien,
 * nulle part, ne le posait : un lieu saisi par erreur restait publié pour
 * toujours. Le mécanisme existait sans son geste, et sans son rattrapage.
 *
 * DEUX FILETS, PAS UN (docs/adr/0005-annuler-plutot-que-confirmer.md) :
 *  - la notification « Supprimé · Annuler », huit secondes, pour la seconde
 *    qui suit le geste — c'est là que se rattrapent presque toutes les erreurs,
 *    et cela évite un dialogue de confirmation à chaque suppression voulue ;
 *  - la corbeille ci-dessous, pour tout le reste du temps. Elle ne coûte rien :
 *    la donnée n'a jamais quitté le stockage, la cacher à son auteur reviendrait
 *    à la lui faire perdre alors qu'elle est là.
 */
export default function MyContributionsPage() {
  const backend = useBackend();
  const session = useAuthStore(s => s.session);
  const showUndo = useUndoToast();

  const placesState = useAsync(
    () =>
      session
        ? backend.places.list({
            authorId: session.userId,
            statuses: PUBLICATION_STATUSES,
            includeDeleted: true,
          })
        : Promise.resolve([]),
    session?.userId ?? 'anon'
  );
  const eventsState = useAsync(
    () =>
      session
        ? backend.events.list({
            authorId: session.userId,
            statuses: EVENT_STATUSES,
            includeDeleted: true,
          })
        : Promise.resolve([]),
    session?.userId ?? 'anon'
  );
  const reviewsState = useAsync(
    () =>
      session
        ? backend.reviews.listByAuthor(session.userId, { includeDeleted: true })
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

  const reloadAll = () => {
    placesState.reload();
    eventsState.reload();
    reviewsState.reload();
  };

  /**
   * Supprime, puis propose de défaire. `reload` d'abord : l'écran doit dire la
   * vérité avant que la notification ne s'affiche, sinon « Annuler » porte sur
   * une ligne encore visible et l'utilisateur ne sait plus ce qui s'est passé.
   */
  const supprimer = (
    label: string,
    remove: () => Promise<void>,
    restore: () => Promise<void>
  ) => {
    void remove().then(() => {
      reloadAll();
      showUndo({
        // « Lieu », « Événement », « Retour » : masculins tous les trois.
        message: `${label} supprimé`,
        onUndo: () => restore().then(reloadAll),
      });
    });
  };

  const statusTone = (status: keyof typeof PUBLICATION_STATUS_LABELS) =>
    status === 'published'
      ? ('success' as const)
      : status === 'pending'
        ? ('warning' as const)
        : status === 'draft'
          ? ('muted' as const)
          : ('danger' as const);

  const vivants = <T extends { deletedAt: string | null }>(items: T[] | null) =>
    (items ?? []).filter(i => i.deletedAt === null);

  const places = vivants(placesState.data);
  const events = vivants(eventsState.data);
  const reviews = vivants(reviewsState.data);

  const visite = (isoDay: string) =>
    new Date(isoDay).toLocaleDateString(getDefaultLocale());

  /** Tout ce qui est supprimé, à plat : la corbeille est une seule liste. */
  const corbeille = [
    ...(placesState.data ?? [])
      .filter(p => p.deletedAt !== null)
      .map(p => ({
        key: `place-${p.id}`,
        kind: 'Lieu',
        label: p.name,
        deletedAt: p.deletedAt as string,
        restore: () => backend.places.restoreOwn(p.id),
      })),
    ...(eventsState.data ?? [])
      .filter(e => e.deletedAt !== null)
      .map(e => ({
        key: `event-${e.id}`,
        kind: 'Événement',
        label: e.title,
        deletedAt: e.deletedAt as string,
        restore: () => backend.events.restoreOwn(e.id),
      })),
    ...(reviewsState.data ?? [])
      .filter(r => r.deletedAt !== null)
      .map(r => ({
        key: `review-${r.id}`,
        kind: 'Retour',
        label: `Visite du ${visite(r.visitedOn)}`,
        deletedAt: r.deletedAt as string,
        restore: () => backend.reviews.restoreOwn(r.id),
      })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  const chargement =
    placesState.loading || eventsState.loading || reviewsState.loading;
  const erreur = placesState.error ?? eventsState.error ?? reviewsState.error;

  return (
    <div>
      <PageHeader
        title="Mes contributions"
        subtitle="Lieux proposés, événements et retours publiés"
      />
      <div className="flex flex-col gap-5 px-fluid-md pb-8">
        {erreur ? <ErrorBanner message={erreur} onRetry={reloadAll} /> : null}

        <section aria-label="Mes lieux">
          <h2 className="mb-2 text-fluid-lg font-semibold">Lieux proposés</h2>
          {chargement ? (
            <SkeletonGroup label="Chargement" lines={2} />
          ) : places.length === 0 ? (
            <EmptyState
              title="Aucun lieu proposé"
              description="Votre premier lieu aidera toutes les familles du coin."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {places.map(place => (
                <li
                  key={place.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-line p-fluid-sm text-fluid-sm"
                >
                  <Link to={`/lieux/${place.id}`} className="underline">
                    {place.name}
                  </Link>
                  <span className="flex items-center gap-2">
                    <Badge tone={statusTone(place.status)}>
                      {PUBLICATION_STATUS_LABELS[place.status]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Supprimer le lieu ${place.name}`}
                      onClick={() =>
                        supprimer(
                          'Lieu',
                          () => backend.places.deleteOwn(place.id),
                          () => backend.places.restoreOwn(place.id)
                        )
                      }
                    >
                      Supprimer
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Mes événements">
          <h2 className="mb-2 text-fluid-lg font-semibold">
            Événements proposés
          </h2>
          {chargement ? (
            <SkeletonGroup label="Chargement" lines={2} />
          ) : events.length === 0 ? (
            <p className="text-fluid-sm text-ink-soft">
              Aucun événement proposé pour l’instant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {events.map(event => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-line p-fluid-sm text-fluid-sm"
                >
                  <Link to={`/agenda/${event.id}`} className="underline">
                    {event.title}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Supprimer l’événement ${event.title}`}
                    onClick={() =>
                      supprimer(
                        'Événement',
                        () => backend.events.deleteOwn(event.id),
                        () => backend.events.restoreOwn(event.id)
                      )
                    }
                  >
                    Supprimer
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Mes retours">
          <h2 className="mb-2 text-fluid-lg font-semibold">
            Retours d’expérience
          </h2>
          {chargement ? (
            <SkeletonGroup label="Chargement" lines={2} />
          ) : reviews.length === 0 ? (
            <p className="text-fluid-sm text-ink-soft">
              Aucun retour publié pour l’instant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-fluid-sm">
              {reviews.map(review => (
                <li
                  key={review.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-line p-fluid-sm"
                >
                  <span>
                    <Link to={`/lieux/${review.placeId}`} className="underline">
                      Visite du {visite(review.visitedOn)}
                    </Link>{' '}
                    — {review.rating}/5
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Supprimer le retour du ${visite(review.visitedOn)}`}
                    onClick={() =>
                      supprimer(
                        'Retour',
                        () => backend.reviews.deleteOwn(review.id),
                        () => backend.reviews.restoreOwn(review.id)
                      )
                    }
                  >
                    Supprimer
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/*
          La corbeille n'apparaît que quand elle a quelque chose : une section
          vide en permanence apprend à ne plus la regarder, et c'est le jour
          où elle compte qu'on ne la verra pas.
        */}
        {corbeille.length > 0 ? (
          <section aria-label="Corbeille" className="border-t border-line pt-4">
            <h2 className="mb-1 text-fluid-lg font-semibold">Corbeille</h2>
            <p className="mb-2 text-fluid-sm text-ink-soft">
              Retiré de la carte et de l’agenda, conservé ici. Rien n’est effacé
              : restaurez quand vous voulez.
            </p>
            <ul className="flex flex-col gap-2 text-fluid-sm">
              {corbeille.map(item => (
                <li
                  key={item.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-dashed border-line p-fluid-sm"
                >
                  <span className="text-ink-soft">
                    <Badge tone="muted">{item.kind}</Badge> {item.label}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Restaurer ${item.label}`}
                    onClick={() => void item.restore().then(reloadAll)}
                  >
                    Restaurer
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
