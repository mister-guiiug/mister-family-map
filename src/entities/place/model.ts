import { z } from 'zod';
import { TRI_STATE_VALUES } from '../../shared/types/tri-state';

/** Statut de publication commun aux contenus collaboratifs. */
export const PUBLICATION_STATUSES = [
  'draft',
  'pending',
  'published',
  'hidden',
  'rejected',
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: 'Brouillon',
  pending: 'En attente de validation',
  published: 'Publié',
  hidden: 'Masqué par la modération',
  rejected: 'Rejeté',
};

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type PlaceCoordinates = z.infer<typeof coordinatesSchema>;

/** Tranche d'âge recommandée, en années (0 = dès la naissance). */
export const ageRangeSchema = z
  .object({
    min: z.number().int().min(0).max(18),
    max: z.number().int().min(0).max(18),
  })
  .refine(r => r.min <= r.max, { message: 'Tranche d’âge incohérente' });
export type AgeRange = z.infer<typeof ageRangeSchema>;

export const priceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('free') }),
  z.object({ kind: z.literal('unknown') }),
  z.object({
    kind: z.literal('paid'),
    /** Fourchette indicative en euros ; jamais un prix « officiel ». */
    minEuros: z.number().min(0).optional(),
    maxEuros: z.number().min(0).optional(),
  }),
]);
export type Price = z.infer<typeof priceSchema>;

export const SETTINGS = ['indoor', 'outdoor', 'mixed', 'unknown'] as const;
export const DIFFICULTIES = ['easy', 'moderate', 'hard', 'unknown'] as const;

const triState = z.enum(TRI_STATE_VALUES);

/**
 * Attributs « famille » d'un lieu (table `place_features`). Tous ternaires :
 * l'absence d'information est une valeur de première classe (`unknown`).
 */
export const placeFeaturesSchema = z.object({
  accessibility: triState,
  stroller: triState,
  petsAllowed: triState,
  waterPoint: triState,
  toilets: triState,
  picnicArea: triState,
  foodNearby: triState,
  weatherProof: triState,
  setting: z.enum(SETTINGS),
  difficulty: z.enum(DIFFICULTIES),
});
export type PlaceFeatures = z.infer<typeof placeFeaturesSchema>;

export const UNKNOWN_FEATURES: PlaceFeatures = {
  accessibility: 'unknown',
  stroller: 'unknown',
  petsAllowed: 'unknown',
  waterPoint: 'unknown',
  toilets: 'unknown',
  picnicArea: 'unknown',
  foodNearby: 'unknown',
  weatherProof: 'unknown',
  setting: 'unknown',
  difficulty: 'unknown',
};

export const placePhotoSchema = z.object({
  id: z.string().min(1),
  /** Chemin objet dans le stockage (jamais d'URL signée persistée). */
  storagePath: z.string().min(1),
  alt: z.string().max(200).default(''),
  authorId: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
});
export type PlacePhoto = z.infer<typeof placePhotoSchema>;

/** Fiche complète d'un point d'intérêt (table `places`). */
export const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(120),
  categoryId: z.string().min(1),
  shortDescription: z.string().max(280),
  description: z.string().max(4000).default(''),
  coordinates: coordinatesSchema,
  address: z.string().max(200).default(''),
  city: z.string().max(100).default(''),
  ageRange: ageRangeSchema.nullable(),
  /** Durée indicative de la visite, en minutes. */
  durationMinutes: z
    .number()
    .int()
    .min(10)
    .max(24 * 60)
    .nullable(),
  price: priceSchema,
  /** Horaires en texte libre si connus — `null` = inconnu, jamais « fermé ». */
  openingHours: z.string().max(500).nullable(),
  websiteUrl: z.url({ protocol: /^https?$/ }).nullable(),
  phone: z.string().max(20).nullable(),
  features: placeFeaturesSchema,
  practicalTips: z.string().max(2000).default(''),
  status: z.enum(PUBLICATION_STATUSES),
  authorId: z.string().min(1),
  /** Date de dernière vérification humaine — `null` = donnée non vérifiée. */
  lastVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
  photos: z.array(placePhotoSchema).default([]),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  /** Suppression logique (contenus collaboratifs — jamais de purge directe). */
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Place = z.infer<typeof placeSchema>;

/** Payload de création côté client (le serveur impose auteur/statut/horodatage). */
export const placeDraftSchema = placeSchema.omit({
  id: true,
  status: true,
  authorId: true,
  lastVerifiedAt: true,
  photos: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type PlaceDraft = z.infer<typeof placeDraftSchema>;

export function isPubliclyVisible(place: Place): boolean {
  return place.status === 'published' && place.deletedAt === null;
}
