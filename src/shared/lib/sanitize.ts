/**
 * Assainissement des contenus utilisateurs.
 *
 * Principe : l'application ne rend JAMAIS de HTML issu des utilisateurs (React
 * échappe le texte, aucun `dangerouslySetInnerHTML`). L'assainissement côté
 * client normalise donc le texte (caractères de contrôle, longueurs) ; la
 * validation d'autorité reste côté serveur (contraintes SQL + RLS).
 */

// Contrôles C0/C1 (sauf \n et \t) + caractères de direction invisibles
// (spoofing bidi). Construit depuis les code points pour rester lisible.
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F' +
    '\\u200E\\u200F\\u202A-\\u202E]',
  'g'
);

export function sanitizeUserText(raw: string, maxLength: number): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

/** Une seule ligne, espaces normalisés (noms, communes, titres). */
export function sanitizeSingleLine(raw: string, maxLength: number): string {
  return sanitizeUserText(raw, maxLength).replace(/\s+/g, ' ');
}

/** Une URL « publiable » : http(s) uniquement, jamais javascript: ni data:. */
export function isSafeHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
