/**
 * Le réglage du thème, en un seul endroit.
 *
 * POURQUOI UN MODULE POUR DEUX CONSTANTES. Elles sont lues par TROIS endroits
 * qui doivent rester d'accord et dont deux ne se voient pas l'un l'autre :
 * `ThemeProvider` (`main.tsx`), le script anti-FOUC d'`index.html`, et le test
 * qui vérifie que les deux lisent bien la même clé. Un désaccord ne casse rien
 * au build : il affiche simplement le premier écran dans le mauvais thème,
 * puis bascule — le genre de défaut que personne ne remonte.
 */

/**
 * Clé FAMILLE, partagée par les apps d'une même origine
 * (`mister-guiiug.github.io`). C'est déjà celle que lit le script anti-FOUC
 * d'`index.html` : aucune migration de clé n'est nécessaire ici, à la
 * différence de six autres apps du parc.
 */
export const THEME_STORAGE_KEY = 'dwc_theme';

/**
 * Couleur de la barre du navigateur, par schéma.
 *
 * `light` reprend à l'octet la `<meta name="theme-color">` d'`index.html` :
 * personne ne voit sa barre changer de couleur en installant la mise à jour.
 * `dark` est la conversion en sRGB du fond sombre de `styles/index.css`
 * (`--color-surface`, `oklch(0.22 0.012 155)`) : sans elle, la barre reste
 * verte au-dessus d'un écran noir.
 */
export const THEME_COLOR = { light: '#2f6f4f', dark: '#161c18' };
