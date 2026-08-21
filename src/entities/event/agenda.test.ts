import { describe, expect, it } from 'vitest';
import type { FamilyEvent } from './model';
import {
  displayStatus,
  eventsOnDay,
  expandOccurrences,
  sortByStart,
  upcomingEvents,
  weekendEvents,
} from './agenda';

function makeEvent(overrides: Partial<FamilyEvent>): FamilyEvent {
  return {
    id: 'e1',
    title: 'Fête du parc',
    description: '',
    categoryId: 'cat-evenement',
    organizer: '',
    placeId: null,
    address: '',
    coordinates: null,
    startsAt: '2026-09-19T14:00:00+02:00',
    endsAt: '2026-09-19T17:00:00+02:00',
    timezone: 'Europe/Paris',
    allDay: false,
    recurrence: null,
    registrationDeadline: null,
    price: { kind: 'free' },
    ageRange: null,
    capacity: null,
    websiteUrl: null,
    bookingInfo: '',
    contact: '',
    accessibility: '',
    indoor: 'outdoor',
    status: 'published',
    authorId: 'u1',
    lastVerifiedAt: null,
    createdAt: '2026-09-01T10:00:00+02:00',
    updatedAt: '2026-09-01T10:00:00+02:00',
    deletedAt: null,
    ...overrides,
  };
}

describe('sortByStart', () => {
  it('trie chronologiquement', () => {
    const later = makeEvent({ id: 'b', startsAt: '2026-09-20T10:00:00+02:00' });
    const sooner = makeEvent({ id: 'a' });
    expect(sortByStart([later, sooner]).map(e => e.id)).toEqual(['a', 'b']);
  });
});

describe('displayStatus', () => {
  it('un événement validé et fini est présenté « terminé »', () => {
    const e = makeEvent({});
    expect(displayStatus(e, new Date('2026-09-25T10:00:00+02:00'))).toBe(
      'finished'
    );
    expect(displayStatus(e, new Date('2026-09-19T15:00:00+02:00'))).toBe(
      'published'
    );
  });

  it('un événement annulé reste annulé, même passé', () => {
    const e = makeEvent({ status: 'cancelled' });
    expect(displayStatus(e, new Date('2026-09-25T10:00:00+02:00'))).toBe(
      'cancelled'
    );
  });
});

describe('upcomingEvents', () => {
  it('exclut le passé et les brouillons, garde l’en-cours', () => {
    const past = makeEvent({
      id: 'past',
      startsAt: '2026-09-01T10:00:00+02:00',
      endsAt: '2026-09-01T12:00:00+02:00',
    });
    const draft = makeEvent({ id: 'draft', status: 'draft' });
    const ongoing = makeEvent({ id: 'ongoing' });
    const list = upcomingEvents(
      [past, draft, ongoing],
      new Date('2026-09-19T15:00:00+02:00')
    );
    expect(list.map(e => e.id)).toEqual(['ongoing']);
  });
});

describe('eventsOnDay (multi-jours)', () => {
  it('un événement sur trois jours apparaît chaque jour', () => {
    const festival = makeEvent({
      id: 'festival',
      startsAt: '2026-09-18T10:00:00+02:00',
      endsAt: '2026-09-20T18:00:00+02:00',
    });
    expect(eventsOnDay([festival], new Date(2026, 8, 19))).toHaveLength(1);
    expect(eventsOnDay([festival], new Date(2026, 8, 21))).toHaveLength(0);
  });
});

describe('weekendEvents', () => {
  it('section « ce week-end » depuis un mercredi', () => {
    const samedi = makeEvent({ id: 'samedi' });
    const lundi = makeEvent({
      id: 'lundi',
      startsAt: '2026-09-21T10:00:00+02:00',
      endsAt: '2026-09-21T12:00:00+02:00',
    });
    const list = weekendEvents(
      [samedi, lundi],
      new Date('2026-09-16T09:00:00+02:00')
    );
    expect(list.map(e => e.id)).toEqual(['samedi']);
  });
});

describe('expandOccurrences', () => {
  it('sans récurrence → une seule occurrence', () => {
    expect(expandOccurrences(makeEvent({}))).toHaveLength(1);
  });

  it('hebdomadaire jusqu’à une borne', () => {
    const e = makeEvent({
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        until: '2026-10-03T23:59:59+02:00',
      },
    });
    const occ = expandOccurrences(e);
    expect(occ).toHaveLength(3); // 19/09, 26/09, 03/10
    expect(occ[1]?.startsAt.getDate()).toBe(26);
  });

  it('borne de sécurité sur le nombre d’occurrences', () => {
    const e = makeEvent({
      recurrence: {
        frequency: 'daily',
        interval: 1,
        until: '2030-01-01T00:00:00+01:00',
      },
    });
    expect(expandOccurrences(e, 10)).toHaveLength(10);
  });
});
