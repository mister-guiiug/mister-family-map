/**
 * Limitation de débit CÔTÉ CLIENT — confort et anti-maladresse uniquement
 * (double envoi, spam involontaire). La limitation d'autorité vit côté
 * serveur (Supabase : contraintes + fonctions — cf. docs/THREAT-MODEL.md).
 *
 * CE FICHIER ÉTAIT LA SOURCE DE `@mister-guiiug/dev-pwa-config/rate-limit`,
 * dont l'en-tête dit « PROMU depuis bac-sable/src/shared/lib/rate-limit.ts ».
 * Les deux copies étaient identiques ligne pour ligne ; celle-ci n'est plus
 * qu'une façade, pour que les sites d'appel ne bougent pas.
 */
export type { RateLimiter } from '@mister-guiiug/dev-pwa-config/rate-limit';
export { createRateLimiter } from '@mister-guiiug/dev-pwa-config/rate-limit';
