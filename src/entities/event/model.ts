import { z } from 'zod';
import { ageRangeSchema, coordinatesSchema, priceSchema } from '../place/model';

/** Statuts du cycle de vie d'un événement. */
export const EVENT_STATUSES = [
  'draft',
  'proposed',
  'published',
  'cancelled',
  'finished',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Brouillon',
  proposed: 'Proposé',
  published: 'Validé',
  cancelled: 'Annulé',
  finished: 'Terminé',
};

/**
 * Récurrence simple (MVP) : le domaine déplie les occurrences ; pas de RRULE
 * complet tant qu'aucun besoin réel ne l'exige.
 */
export const recurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  interval: z.number().int().min(1).max(12).default(1),
  until: z.iso.datetime({ offset: true }),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

export const familyEventSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(2).max(140),
    description: z.string().max(4000).default(''),
    categoryId: z.string().min(1),
    organizer: z.string().max(120).default(''),
    /** Lieu associé (facultatif) — sinon adresse/coordonnées propres. */
    placeId: z.string().nullable(),
    address: z.string().max(200).default(''),
    coordinates: coordinatesSchema.nullable(),
    /** Instants ISO 8601 AVEC offset ; `timezone` = fuseau IANA d'affichage. */
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    timezone: z.string().min(1).default('Europe/Paris'),
    /** Événement « journée(s) entière(s) » : les heures ne font pas foi. */
    allDay: z.boolean().default(false),
    recurrence: recurrenceSchema.nullable(),
    registrationDeadline: z.iso.datetime({ offset: true }).nullable(),
    price: priceSchema,
    ageRange: ageRangeSchema.nullable(),
    capacity: z.number().int().min(1).nullable(),
    websiteUrl: z.url({ protocol: /^https?$/ }).nullable(),
    bookingInfo: z.string().max(500).default(''),
    contact: z.string().max(200).default(''),
    accessibility: z.string().max(500).default(''),
    indoor: z.enum(['indoor', 'outdoor', 'mixed', 'unknown']),
    status: z.enum(EVENT_STATUSES),
    authorId: z.string().min(1),
    lastVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    deletedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine(e => new Date(e.endsAt).getTime() >= new Date(e.startsAt).getTime(), {
    message: 'La fin doit être postérieure au début',
    path: ['endsAt'],
  });
export type FamilyEvent = z.infer<typeof familyEventSchema>;

export const eventDraftSchema = z.object({
  title: z.string().min(2).max(140),
  description: z.string().max(4000).default(''),
  categoryId: z.string().min(1),
  organizer: z.string().max(120).default(''),
  placeId: z.string().nullable(),
  address: z.string().max(200).default(''),
  coordinates: coordinatesSchema.nullable(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  timezone: z.string().min(1).default('Europe/Paris'),
  allDay: z.boolean().default(false),
  recurrence: recurrenceSchema.nullable(),
  registrationDeadline: z.iso.datetime({ offset: true }).nullable(),
  price: priceSchema,
  ageRange: ageRangeSchema.nullable(),
  capacity: z.number().int().min(1).nullable(),
  websiteUrl: z.url({ protocol: /^https?$/ }).nullable(),
  bookingInfo: z.string().max(500).default(''),
  contact: z.string().max(200).default(''),
  accessibility: z.string().max(500).default(''),
  indoor: z.enum(['indoor', 'outdoor', 'mixed', 'unknown']),
});
export type EventDraft = z.infer<typeof eventDraftSchema>;
