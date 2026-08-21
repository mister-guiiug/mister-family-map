/**
 * Outils de dates purs. Les événements stockent des instants ISO 8601 AVEC
 * offset + un fuseau IANA ; ces helpers travaillent sur des `Date` déjà
 * résolues et reçoivent toujours `now` en argument (testabilité, pas d'horloge
 * implicite).
 */

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/**
 * Prochain week-end (samedi 00:00 → dimanche 23:59) par rapport à `now`.
 * Si `now` est déjà samedi ou dimanche, le week-end en cours est renvoyé
 * (depuis `now`, pas depuis samedi minuit : le passé n'est pas proposé).
 */
export function upcomingWeekendRange(now: Date): { from: Date; to: Date } {
  const day = now.getDay(); // 0 = dimanche, 6 = samedi
  if (day === 6) return { from: new Date(now), to: endOfDay(addDays(now, 1)) };
  if (day === 0) return { from: new Date(now), to: endOfDay(now) };
  const daysUntilSaturday = 6 - day;
  const saturday = startOfDay(addDays(now, daysUntilSaturday));
  return { from: saturday, to: endOfDay(addDays(saturday, 1)) };
}

/** Deux intervalles [aFrom, aTo] et [bFrom, bTo] se recouvrent-ils ? */
export function rangesOverlap(
  aFrom: Date,
  aTo: Date,
  bFrom: Date,
  bTo: Date
): boolean {
  return aFrom.getTime() <= bTo.getTime() && bFrom.getTime() <= aTo.getTime();
}

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

/** « samedi 12 septembre » / « samedi 12 septembre, 14:30 » */
export function formatDay(d: Date): string {
  return DAY_FORMAT.format(d);
}

export function formatDayTime(d: Date): string {
  return `${DAY_FORMAT.format(d)}, ${TIME_FORMAT.format(d)}`;
}
