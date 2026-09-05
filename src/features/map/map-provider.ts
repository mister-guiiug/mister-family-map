/**
 * Port MapProvider — désormais **porté par le paquet partagé**
 * (`@mister-guiiug/dev-pwa-config/map`), promu depuis cette app.
 *
 * Ce fichier reste le point d'entrée interne : les écrans continuent
 * d'importer `../map-provider`, sans connaître ni le paquet ni le moteur.
 * Choix du fournisseur et contraintes d'intégration :
 * docs/adr/0001-map-provider.md.
 */
export type {
  MapMarker,
  MapProvider,
  MapProviderFactory,
  MapProviderOptions,
  MapViewport,
} from '@mister-guiiug/dev-pwa-config/map';
