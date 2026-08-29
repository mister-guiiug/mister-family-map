/**
 * Géographie pure — déléguée au socle.
 *
 * CE FICHIER A ÉTÉ PROMU. Ses soixante lignes (haversine, validation, boîte
 * englobante avec l'antiméridien, `formatDistance`) vivent désormais dans
 * `@mister-guiiug/dev-wpa-config/geo`, à l'identique — cette app en était la
 * source. Il ne reste ici que la ré-exportation, pour que les vingt imports
 * existants (`../lib/geo`) continuent de compiler sans une réécriture de
 * masse ; les nouveaux écrans peuvent importer le socle directement.
 *
 * `geo.test.ts` reste en place et teste À TRAVERS cette délégation : c'est le
 * contrat de l'app, et il attraperait une régression du paquet.
 */
export type {
  BoundingBox,
  Coordinates,
} from '@mister-guiiug/dev-wpa-config/geo';
export {
  distanceKm,
  formatDistance,
  isInBoundingBox,
  isValidCoordinates,
  isValidLatitude,
  isValidLongitude,
} from '@mister-guiiug/dev-wpa-config/geo';
