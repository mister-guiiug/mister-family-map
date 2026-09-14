/**
 * Rend les DEUX images à fond perdu depuis `public/icon-maskable.svg` :
 * le maskable Android (512) et l'icône d'accueil iOS (180).
 *
 * POURQUOI UN SVG À PART, ET PAS `pwa-icons --maskable`. Le générateur du socle
 * fabrique un maskable en RÉDUISANT la source dans la zone de sécurité, sur un
 * fond uni. Quand la source est une tuile arrondie — c'est le cas ici — le
 * résultat est cette tuile posée sur un aplat, et le raccord se voit : Android
 * en fait un liseré tout autour de l'icône. Avec `--bg` on peut rapprocher les
 * deux couleurs, jamais supprimer le raccord.
 *
 * Un maskable se DESSINE à fond perdu. `icon-maskable.svg` reprend le même
 * dégradé et le même dessin que `favicon.svg`, sans les coins arrondis et avec
 * le sujet tenu dans le disque de sécurité. Le commentaire du SVG dit ce qui en
 * diffère, et pourquoi.
 *
 * ET POURQUOI L'ICÔNE APPLE EST ICI, ET PLUS DANS `npm run icons`. Le même
 * `--bg` la frappait, mais SANS qu'on ait rien demandé : `pwa-icons` écrit
 * `apple-touch-icon.png` par défaut, `--maskable` ou pas. iOS n'accepte pas la
 * transparence et APLATIT les coins de la tuile arrondie sur cette couleur.
 * Mesuré sur le fichier livré jusqu'au 14/09/2026 : coin à `12,18,34` quand le
 * bord de la tuile rendait `47,111,79`. Du bleu nuit autour d'une tuile verte,
 * sur l'écran d'accueil d'un iPhone — exactement le défaut corrigé plus haut
 * pour Android, resté en place pour iOS.
 *
 * La source à fond perdu n'a, elle, aucun coin à aplatir. Et le sujet y est déjà
 * tenu dans la zone de sécurité, ce qui sert aussi à iOS : son masque rogne
 * moins qu'un cercle, mais il rogne. D'où `--no-apple` dans le script `icons`.
 *
 * Exécuter : npm run icons:maskable
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

// `density` : sans elle, sharp pixellise le SVG à 72 ppp AVANT de
// redimensionner, et le dégradé en ressort bandé.
const rend = (taille, nom) =>
  sharp(join(racine, 'public', 'icon-maskable.svg'), { density: 384 })
    .resize(taille, taille)
    .png()
    .toFile(join(racine, 'public', nom));

await rend(512, 'icon-maskable.png');
await rend(180, 'apple-touch-icon.png');

console.log(
  'public/icon-maskable.png (512×512) et public/apple-touch-icon.png (180×180) écrits, à fond perdu.'
);
