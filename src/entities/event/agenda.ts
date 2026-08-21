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
