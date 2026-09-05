/**
 * Assainissement des contenus utilisateurs.
 *
 * Principe : l'application ne rend JAMAIS de HTML issu des utilisateurs (React
 * échappe le texte, aucun `dangerouslySetInnerHTML`). L'assainissement côté
 * client normalise donc le texte (caractères de contrôle, longueurs) ; la
 * validation d'autorité reste côté serveur (contraintes SQL + RLS).
 *
 * LES TROIS FONCTIONS VIENNENT DU SOCLE depuis aujourd'hui. Elles y étaient
 * déjà, à l'identique — l'en-tête de `security.js` raconte la promotion :
 * « Trois apps portaient un utilitaire de sécurité, dont DEUX IDENTIQUES À
 * L'OCTET, et dont l'en-tête disait déjà littéralement “Utilitaires de
 * sécurité pour tous les projets”. »
 *
 * La version publiée ajoute un `String(raw ?? '')` en entrée. Sans effet ici —
 * TypeScript garantit déjà une chaîne aux sites d'appel — mais elle protège
 * du `undefined` venu d'un JSON, ce que la copie locale ne faisait pas.
 */
export {
  isSafeHttpUrl,
  sanitizeSingleLine,
  sanitizeUserText,
} from '@mister-guiiug/dev-pwa-config/security';
