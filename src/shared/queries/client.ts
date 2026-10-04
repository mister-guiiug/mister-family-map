/**
 * Client Query — defaults PWA du socle.
 * `refetchOnWindowFocus: false` : une liste de lieux n'est pas un flux live.
 */
export {
  getQueryClient,
  createQueryClient,
  resetQueryClient,
  PWA_QUERY_DEFAULTS,
} from '@mister-guiiug/dev-pwa-config/react/query-client';
