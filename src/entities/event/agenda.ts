import { addDays, type IcalEvent } from '@mister-guiiug/dev-wpa-config/ical';
import {
  endOfDay,
  rangesOverlap,
  startOfDay,
  upcomingWeekendRange,
} from '../../shared/lib/dates';
import type { FamilyEvent } from './model';

/**
 * Logique d'agenda pure. `now` est toujours passé en argument — pas d'horloge
 * implicite, donc testable et stable hors ligne.
 */

/** Un événement est-il visible au public ? (validé, non supprimé) */
export function isPublicEvent(e: FamilyEvent): boolean {
  return (
    (e.status === 'published' || e.status === 'cancelled') &&
    e.deletedAt === null
  );
}

/**
 * Statut d'affichage : un événement validé dont la fin est passée est présenté
 * « terminé » sans attendre une écriture en base.
 */
export function displayStatus(
  e: FamilyEvent,
  now: Date
): FamilyEvent['status'] {
  if (
    e.status === 'published' &&
    new Date(e.endsAt).getTime() < now.getTime()
  ) {
    return 'finished';
  }
  return e.status;
}

/** Tri chronologique par début, les événements longs déjà commencés d'abord. */
export function sortByStart(events: readonly FamilyEvent[]): FamilyEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );
}

/** Événements à venir (ou en cours), triés. */
export function upcomingEvents(
  events: readonly FamilyEvent[],
  now: Date
): FamilyEvent[] {
  return sortByStart(
    events.filter(
      e => isPublicEvent(e) && new Date(e.endsAt).getTime() >= now.getTime()
    )
  );
}

/** Événements chevauchant un jour donné (gère le multi-jours). */
export function eventsOnDay(
  events: readonly FamilyEvent[],
  day: Date
): FamilyEvent[] {
  const from = startOfDay(day);
  const to = endOfDay(day);
  return sortByStart(
    events.filter(
      e =>
        isPublicEvent(e) &&
        rangesOverlap(new Date(e.startsAt), new Date(e.endsAt), from, to)
    )
  );
}

/** Section « Ce week-end ». */
export function weekendEvents(
  events: readonly FamilyEvent[],
  now: Date
): FamilyEvent[] {
  const { from, to } = upcomingWeekendRange(now);
  return sortByStart(
    events.filter(
      e =>
        isPublicEvent(e) &&
        rangesOverlap(new Date(e.startsAt), new Date(e.endsAt), from, to)
    )
  );
}

/* ── Export calendrier ─────────────────────────────────────────────────── */

/**
 * Jour civil (`AAAA-MM-JJ`) d'un instant, LU DANS LE FUSEAU DE L'ÉVÉNEMENT.
 *
 * `startsAt` est un instant, pas un cadran : le jour UTC d'une fête du
 * 19 septembre saisie à Paris est le 18 (22 h UTC la veille). La lire depuis
 * un `Date` décale donc la journée entière d'un jour — à l'est de Greenwich
 * seulement, ce qui est précisément là où sont les utilisateurs.
 */
function civilDay(iso: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** `timezone` vient de la donnée : un fuseau inconnu ne doit pas lever. */
function safeCivilDay(iso: string, timeZone: string): string {
  try {
    return civilDay(iso, timeZone);
  } catch {
    return civilDay(iso, undefined);
  }
}

/** Le cycle de vie du domaine vers les trois seuls `STATUS` de la RFC. */
const ICAL_STATUS: Record<FamilyEvent['status'], IcalEvent['status']> = {
  draft: 'TENTATIVE',
  proposed: 'TENTATIVE',
  published: 'CONFIRMED',
  cancelled: 'CANCELLED',
  finished: 'CONFIRMED',
};

/**
 * Traduit un événement du domaine en `VEVENT` pour
 * `@mister-guiiug/dev-wpa-config/ical`.
 *
 * NATURE DE LA DATE — le choix n'est pas cosmétique. Une sortie en famille est
 * un INSTANT, pas une heure flottante : elle a lieu à un endroit précis, et
 * l'app entière la traite déjà ainsi (`startsAt` porte un décalage, les listes
 * l'affichent via `toLocaleString`). Écrire une heure flottante ferait dire au
 * `.ics` autre chose que la page qui vient de l'engendrer, dès que le lecteur
 * n'est plus dans le fuseau de saisie. Le socle sait les trois écritures ; ici
 * c'est UTC.
 *
 * Sauf pour une JOURNÉE ENTIÈRE, où l'heure ne fait pas foi : on écrit alors
 * le jour du calendrier, lu dans le fuseau de l'événement, et un `DTEND`
 * exclusif (`endsAt` borne le dernier jour, la RFC veut le lendemain).
 */
export function eventToIcal(e: FamilyEvent): IcalEvent {
  const common = {
    uid: e.id,
    summary: e.title,
    description: e.description,
    location: e.address,
    status: ICAL_STATUS[e.status],
    ...(e.websiteUrl ? { url: e.websiteUrl } : {}),
  };
  if (e.allDay) {
    return {
      ...common,
      allDay: true,
      start: safeCivilDay(e.startsAt, e.timezone),
      end: addDays(safeCivilDay(e.endsAt, e.timezone), 1),
    };
  }
  return { ...common, start: e.startsAt, end: e.endsAt };
}

/**
 * Déplie une récurrence simple en occurrences concrètes (bornées par `until`
 * et par un maximum de sécurité).
 */
export function expandOccurrences(
  e: FamilyEvent,
  maxOccurrences = 52
): Array<{ startsAt: Date; endsAt: Date }> {
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  if (!e.recurrence) return [{ startsAt: start, endsAt: end }];

  const { frequency, interval, until } = e.recurrence;
  const untilDate = new Date(until);
  const durationMs = end.getTime() - start.getTime();
  const occurrences: Array<{ startsAt: Date; endsAt: Date }> = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= untilDate.getTime()) {
    occurrences.push({
      startsAt: new Date(cursor),
      endsAt: new Date(cursor.getTime() + durationMs),
    });
    if (occurrences.length >= maxOccurrences) break;
    if (frequency === 'daily') cursor.setDate(cursor.getDate() + interval);
    else if (frequency === 'weekly')
      cursor.setDate(cursor.getDate() + 7 * interval);
    else cursor.setMonth(cursor.getMonth() + interval);
  }
  return occurrences;
}
