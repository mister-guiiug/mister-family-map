import { describe, expect, it } from 'vitest';
import {
  addDays,
  isSameDay,
  rangesOverlap,
  upcomingWeekendRange,
} from './dates';

describe('isSameDay', () => {
  it('même jour, heures différentes', () => {
    expect(isSameDay(new Date(2026, 8, 12, 8), new Date(2026, 8, 12, 22))).toBe(
      true
    );
  });

  it('jours différents', () => {
    expect(isSameDay(new Date(2026, 8, 12), new Date(2026, 8, 13))).toBe(false);
  });
});

describe('upcomingWeekendRange', () => {
  it("en semaine → samedi 00:00 jusqu'à dimanche 23:59", () => {
    // Mercredi 16 septembre 2026.
    const { from, to } = upcomingWeekendRange(new Date(2026, 8, 16, 10));
    expect(from.getDay()).toBe(6);
    expect(from.getHours()).toBe(0);
    expect(to.getDay()).toBe(0);
    expect(to.getHours()).toBe(23);
  });

  it('un samedi → depuis maintenant (pas depuis minuit)', () => {
    // Samedi 19 septembre 2026, 15h.
    const now = new Date(2026, 8, 19, 15);
    const { from, to } = upcomingWeekendRange(now);
    expect(from.getTime()).toBe(now.getTime());
    expect(to.getDay()).toBe(0);
  });

  it('un dimanche → le reste de la journée uniquement', () => {
    const now = new Date(2026, 8, 20, 11);
    const { from, to } = upcomingWeekendRange(now);
    expect(from.getTime()).toBe(now.getTime());
    expect(isSameDay(from, to)).toBe(true);
  });
});

describe('rangesOverlap', () => {
  const d = (day: number, h = 0) => new Date(2026, 8, day, h);

  it('recouvrement partiel et inclusion', () => {
    expect(rangesOverlap(d(1), d(3), d(2), d(4))).toBe(true);
    expect(rangesOverlap(d(1), d(10), d(2), d(3))).toBe(true);
  });

  it('bornes qui se touchent → recouvrement (inclusif)', () => {
    expect(rangesOverlap(d(1), d(2), d(2), d(3))).toBe(true);
  });

  it('intervalles disjoints', () => {
    expect(rangesOverlap(d(1), d(2), d(3, 1), d(4))).toBe(false);
  });
});

describe('addDays', () => {
  it('franchit les fins de mois', () => {
    expect(addDays(new Date(2026, 0, 31), 1).getMonth()).toBe(1);
  });
});
