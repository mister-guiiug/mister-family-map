import { describe, expect, it } from 'vitest';
import {
  averageRating,
  isVisitDateValid,
  reviewSchema,
  type Review,
} from './model';

function makeReview(overrides: Partial<Review>): Review {
  return {
    id: 'r1',
    placeId: 'p1',
    authorId: 'u1',
    visitedOn: '2026-08-15',
    ageBrackets: ['3-5'],
    rating: 4,
    positives: 'Jeux ombragés',
    watchouts: 'Parking saturé le dimanche',
    accessibilityNotes: '',
    crowdLevel: 'moderate',
    valueForMoney: 'good',
    practicalTips: '',
    photoIds: [],
    status: 'published',
    createdAt: '2026-08-15T18:00:00+02:00',
    updatedAt: '2026-08-15T18:00:00+02:00',
    deletedAt: null,
    ...overrides,
  };
}

describe('reviewSchema', () => {
  it('borne la note entre 1 et 5', () => {
    expect(reviewSchema.safeParse(makeReview({ rating: 0 })).success).toBe(
      false
    );
    expect(reviewSchema.safeParse(makeReview({ rating: 6 })).success).toBe(
      false
    );
    expect(reviewSchema.safeParse(makeReview({ rating: 5 })).success).toBe(
      true
    );
  });
});

describe('isVisitDateValid', () => {
  const now = new Date('2026-08-21T12:00:00+02:00');

  it("accepte aujourd'hui et le passé, refuse le futur", () => {
    expect(isVisitDateValid('2026-08-21', now)).toBe(true);
    expect(isVisitDateValid('2026-08-01', now)).toBe(true);
    expect(isVisitDateValid('2026-08-22', now)).toBe(false);
  });
});

describe('averageRating', () => {
  it('ignore les retours non publiés ou supprimés', () => {
    const reviews = [
      makeReview({ rating: 5 }),
      makeReview({ id: 'r2', rating: 3 }),
      makeReview({ id: 'r3', rating: 1, status: 'pending' }),
      makeReview({ id: 'r4', rating: 1, deletedAt: '2026-08-16T00:00:00Z' }),
    ];
    expect(averageRating(reviews)).toBe(4);
  });

  it('aucun retour publié → null (jamais un faux zéro)', () => {
    expect(averageRating([])).toBeNull();
  });
});
