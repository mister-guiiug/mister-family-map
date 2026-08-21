import { z } from 'zod';
import { PUBLICATION_STATUSES } from '../place/model';

/**
 * Retour d'expérience structuré. Conçu pour produire de l'information utile
 * (points de vigilance, affluence, accessibilité constatée) plutôt que des
 * avis d'humeur ; la composition familiale est facultative et JAMAIS
 * nominative (tranches d'âge uniquement — aucune donnée sur les enfants).
 */

export const CROWD_LEVELS = ['quiet', 'moderate', 'busy', 'unknown'] as const;
export const VALUE_FOR_MONEY = ['good', 'fair', 'poor', 'unknown'] as const;

/** Tranches d'âge anonymes des enfants concernés par la visite. */
export const AGE_BRACKETS = ['0-2', '3-5', '6-9', '10-13', '14-18'] as const;
export type AgeBracket = (typeof AGE_BRACKETS)[number];

export const reviewSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  authorId: z.string().min(1),
  /** Date de visite (jour, sans heure) — jamais dans le futur (métier). */
  visitedOn: z.iso.date(),
  ageBrackets: z.array(z.enum(AGE_BRACKETS)).max(5).default([]),
  /** Appréciation globale 1..5. */
  rating: z.number().int().min(1).max(5),
  positives: z.string().max(1000).default(''),
  watchouts: z.string().max(1000).default(''),
  accessibilityNotes: z.string().max(500).default(''),
  crowdLevel: z.enum(CROWD_LEVELS),
  valueForMoney: z.enum(VALUE_FOR_MONEY),
  practicalTips: z.string().max(1000).default(''),
  photoIds: z.array(z.string()).max(6).default([]),
  status: z.enum(PUBLICATION_STATUSES),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Review = z.infer<typeof reviewSchema>;

export const reviewDraftSchema = reviewSchema.omit({
  id: true,
  authorId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;

/** Une visite ne peut pas être datée dans le futur. */
export function isVisitDateValid(visitedOn: string, now: Date): boolean {
  return new Date(`${visitedOn}T00:00:00`).getTime() <= now.getTime();
}

/** Note moyenne sur les retours publiés (null si aucun). */
export function averageRating(reviews: readonly Review[]): number | null {
  const published = reviews.filter(
    r => r.status === 'published' && r.deletedAt === null
  );
  if (published.length === 0) return null;
  const sum = published.reduce((s, r) => s + r.rating, 0);
  return Math.round((sum / published.length) * 10) / 10;
}
