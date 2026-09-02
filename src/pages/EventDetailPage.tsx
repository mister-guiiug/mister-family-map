import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  SkeletonGroup,
} from '@mister-guiiug/dev-wpa-config/react';
import { ICAL_MIME, toIcalendar } from '@mister-guiiug/dev-wpa-config/ical';
import { CalendarPlus } from 'lucide-react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import {
  displayStatus,
  eventToIcal,
  expandOccurrences,
} from '../entities/event/agenda';
import { EVENT_STATUS_LABELS } from '../entities/event/model';
import { formatDayTime } from '../shared/lib/dates';
import { getDefaultLocale } from '@mister-guiiug/dev-wpa-config/format';

export default function EventDetailPage() {
  const { id = '' } = useParams();
  const backend = useBackend();
  const now = useMemo(() => new Date(), []);
  const eventState = useAsync(() => backend.events.getById(id), id);

  if (eventState.loading)
    return (
      <div className="p-fluid-md">
        <SkeletonGroup label="Chargement de l'événement" lines={5} />
      </div>
    );
  if (eventState.error)
    return (
      <div className="p-fluid-md">
        <ErrorBanner message={eventState.error} onRetry={eventState.reload} />
      </div>
    );
  const event = eventState.data;
  if (!event)
    return (
      <div className="p-fluid-md">
        <EmptyState
          title="Événement introuvable"
          description="Il a peut-être été annulé ou retiré."
          action={
            <Link to="/agenda" className="underline">
              Retour à l’agenda
            </Link>
          }
        />
      </div>
    );

  const status = displayStatus(event, now);
  const occurrences = expandOccurrences(event, 8);

  const exportIcs = () => {
    // `uidDomain` et `prodId` reproduisent l'export d'avant le socle : un `UID`
    // qui change ferait DOUBLONNER l'événement au lieu de le mettre à jour.
    const ics = toIcalendar([eventToIcal(event)], {
      prodId: '-//mister-family-map//FR',
      uidDomain: 'mister-family-map',
    });
    const blob = new Blob([ics], { type: ICAL_MIME });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${event.title.replace(/\W+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <article className="px-fluid-md pt-safe-top">
      <header className="pt-fluid-md">
        <h1 className="text-fluid-2xl font-bold">{event.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-fluid-sm text-ink-soft">
          {status === 'cancelled' ? (
            <Badge tone="danger">Annulé</Badge>
          ) : status === 'finished' ? (
            <Badge tone="muted">{EVENT_STATUS_LABELS.finished}</Badge>
          ) : null}
          {event.organizer ? <span>Par {event.organizer}</span> : null}
          {event.lastVerifiedAt === null ? (
            <Badge tone="warning" variant="outline">
              Non vérifié
            </Badge>
          ) : null}
        </p>
      </header>

      {status === 'cancelled' ? (
        <p
          role="alert"
          className="mt-3 rounded-(--radius-card) border border-(--dwc-danger) p-fluid-sm text-fluid-sm"
        >
          Cet événement est annulé — vérifiez le site de l’organisateur avant de
          vous déplacer.
        </p>
      ) : null}

      <section aria-label="Dates" className="mt-4">
        <h2 className="text-fluid-lg font-semibold">Quand ?</h2>
        <ul className="mt-1 text-fluid-sm">
          {occurrences.map(occ => (
            <li key={occ.startsAt.toISOString()}>
              {event.allDay
                ? occ.startsAt.toLocaleDateString(getDefaultLocale(), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                : formatDayTime(occ.startsAt)}
            </li>
          ))}
        </ul>
        {event.registrationDeadline ? (
          <p className="mt-1 text-fluid-sm text-ink-soft">
            Inscription avant le{' '}
            {new Date(event.registrationDeadline).toLocaleDateString(
              getDefaultLocale()
            )}
            .
          </p>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={exportIcs}
        >
          <CalendarPlus size={18} aria-hidden="true" />
          Ajouter à mon calendrier
        </Button>
      </section>

      <section aria-label="Informations" className="mt-4 pb-8">
        <h2 className="text-fluid-lg font-semibold">Infos pratiques</h2>
        {event.description ? (
          <p className="mt-1 whitespace-pre-line text-fluid-sm">
            {event.description}
          </p>
        ) : null}
        <dl className="mt-2 text-fluid-sm">
          {event.address ? (
            <>
              <dt className="font-medium">Adresse</dt>
              <dd>{event.address}</dd>
            </>
          ) : null}
          {event.placeId ? (
            <>
              <dt className="mt-1 font-medium">Lieu associé</dt>
              <dd>
                <Link to={`/lieux/${event.placeId}`} className="underline">
                  Voir la fiche du lieu
                </Link>
              </dd>
            </>
          ) : null}
          <dt className="mt-1 font-medium">Tarif</dt>
          <dd>
            {event.price.kind === 'free'
              ? 'Gratuit'
              : event.price.kind === 'unknown'
                ? 'Information inconnue'
                : 'Payant'}
          </dd>
          {event.ageRange ? (
            <>
              <dt className="mt-1 font-medium">Âges</dt>
              <dd>
                De {event.ageRange.min} à {event.ageRange.max} ans
              </dd>
            </>
          ) : null}
          {event.capacity ? (
            <>
              <dt className="mt-1 font-medium">Places</dt>
              <dd>{event.capacity} places</dd>
            </>
          ) : null}
          {event.bookingInfo ? (
            <>
              <dt className="mt-1 font-medium">Réservation</dt>
              <dd>{event.bookingInfo}</dd>
            </>
          ) : null}
          {event.accessibility ? (
            <>
              <dt className="mt-1 font-medium">Accessibilité</dt>
              <dd>{event.accessibility}</dd>
            </>
          ) : null}
        </dl>
        {event.websiteUrl ? (
          <p className="mt-2 text-fluid-sm">
            <a
              href={event.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Site officiel de l’événement
            </a>{' '}
            <span className="text-ink-soft">
              (lien fourni par la communauté — il peut avoir expiré)
            </span>
          </p>
        ) : null}
      </section>
    </article>
  );
}
