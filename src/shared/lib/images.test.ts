import { describe, expect, it } from 'vitest';
import { IMAGE_MAX_BYTES, validateImageFile } from './images';

describe('validateImageFile', () => {
  it('accepte JPEG/PNG/WebP sous la taille maximale', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateImageFile({ type: 'image/webp', size: 1000 })).toBeNull();
  });

  it('rejette les types non image (dont SVG, vecteur de XSS)', () => {
    expect(validateImageFile({ type: 'image/svg+xml', size: 10 })).toBe('type');
    expect(validateImageFile({ type: 'application/pdf', size: 10 })).toBe(
      'type'
    );
  });

  it('rejette au-delà de la taille maximale', () => {
    expect(
      validateImageFile({ type: 'image/png', size: IMAGE_MAX_BYTES + 1 })
    ).toBe('size');
  });
});
