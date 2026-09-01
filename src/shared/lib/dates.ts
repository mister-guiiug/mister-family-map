/**
 * Outils de dates. L'arithmétique vient du socle ; ce qui reste ici est ce
 * qu'aucune autre app n'a : le week-end à venir, et le format d'affichage.
 *
 * CE FICHIER EST LA SOURCE DE `@mister-guiiug/dev-wpa-config/dates`. Son
 * en-tête le dit — « PROMU, PAS INVENTÉ. Trois apps portaient chacune leur
 * module dates : bac-sable (arithmétique d'intervalles) […] ». L'app qui a
 * donné le code ne l'avait jamais réadopté, et les deux copies étaient
 * identiques au caractère près.
 *
 * Une façade plutôt qu'un remplacement des appels : les cinq fonctions gardent
 * leur nom et leur emplacement, `upcomingWeekendRange` reste à côté de ses
 * aides, et aucun des vingt-cinq sites d'appel ne bouge.
 *
 * LE FORMATAGE RESTE LOCAL, et c'est la règle du socle : `dates` est pur,
 * l'affichage vit dans `format`. `formatDay` compose un jour de semaine, un
 * quantième et un mois en français — une décision de produit, pas une
 * primitive.
 */
export {
  addDays,
  endOfDay,
  isSameDay,
  rangesOverlap,
  startOfDay,
} from '@mister-guiiug/dev-wpa-config/dates';

import {
  addDays,
  endOfDay,
  startOfDay,
} from '@mister-guiiug/dev-wpa-config/dates';

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
