import { Link } from 'react-router';
import { CalendarDays, MapPin } from 'lucide-react';
import { Badge } from '@mister-guiiug/dev-pwa-config/react';
import type { FamilyEvent } from '../../../entities/event/model';
import { EVENT_STATUS_LABELS } from '../../../entities/event/model';
import { displayStatus } from '../../../entities/event/agenda';
import { formatDay, formatDayTime, isSameDay } from '../../../shared/lib/dates';

function formatEventDates(e: FamilyEvent): string {
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  if (e.allDay) {
    return isSameDay(start, end)
      ? formatDay(start)
      : `Du ${formatDay(start)} au ${formatDay(end)}`;
  }
  return isSameDay(start, end)
    ? formatDayTime(start)
    : `Du ${formatDayTime(start)} au ${formatDayTime(end)}`;
}

export function EventCard({ event, now }: { event: FamilyEvent; now: Date }) {
  const status = displayStatus(event, now);
  return (
    <article className="rounded-(--radius-card) border border-line bg-surface-2 p-fluid-md">
      <h3 className="text-fluid-lg font-semibold">
        <Link
          to={`/agenda/${event.id}`}
          className="hover:underline focus-visible:underline"
        >
          {event.title}
        </Link>
      </h3>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-fluid-sm text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={13} aria-hidden="true" />
          {formatEventDates(event)}
        </span>
        {event.address ? (
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} aria-hidden="true" />
            {event.address}
          </span>
        ) : null}
        {status === 'cancelled' ? (
          <Badge tone="danger">Annulé</Badge>
        ) : status === 'finished' ? (
          <Badge tone="muted">{EVENT_STATUS_LABELS.finished}</Badge>
        ) : event.price.kind === 'free' ? (
          <Badge tone="success" variant="outline">
            Gratuit
          </Badge>
        ) : null}
      </p>
      {event.description ? (
        <p className="mt-2 line-clamp-2 text-fluid-sm">{event.description}</p>
      ) : null}
    </article>
  );
}
