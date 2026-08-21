/**
 * Contrôles de téléversement photo + suppression des métadonnées sensibles.
 *
 * Le ré-encodage via canvas supprime par construction EXIF / GPS / numéro de
 * série : seul le contenu visuel survit. Les contrôles serveur (taille, type,
 * règles du bucket) restent la barrière d'autorité.
 */

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMAGE_MAX_DIMENSION = 2048;

export type ImageValidationError = 'type' | 'size';

export function validateImageFile(file: {
  type: string;
  size: number;
}): ImageValidationError | null {
  if (!IMAGE_ACCEPTED_TYPES.includes(file.type)) return 'type';
  if (file.size > IMAGE_MAX_BYTES) return 'size';
  return null;
}

/**
 * Ré-encode l'image (redimensionnée si besoin) en WebP sans métadonnées.
 * Nécessite le DOM — appelée uniquement depuis le parcours de contribution.
 */
export async function stripImageMetadata(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob =>
        blob ? resolve(blob) : reject(new Error('Échec du ré-encodage')),
      'image/webp',
      0.85
    );
  });
}
