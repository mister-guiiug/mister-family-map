/**
 * Identifiants stables (UUID v4) — DU SOCLE (`@mister-guiiug/dev-pwa-config/id`).
 *
 * `newId` appelait `crypto.randomUUID()` sans repli : indisponible hors
 * contexte sécurisé (http:// sur le réseau local, vieux WebView), il levait.
 * `createUuid` du socle retombe sur un v4 correct — bits de version et de
 * variante posés — au lieu d'échouer (PARC.md, chantier 3).
 */
export { createUuid as newId } from '@mister-guiiug/dev-pwa-config/id';
