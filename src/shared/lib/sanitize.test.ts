import { describe, expect, it } from 'vitest';
import {
  isSafeHttpUrl,
  sanitizeSingleLine,
  sanitizeUserText,
} from './sanitize';

describe('sanitizeUserText', () => {
  it('retire les caractères de contrôle mais garde les sauts de ligne', () => {
    expect(sanitizeUserText('a\u0000b\nc\u001bd', 100)).toBe('ab\ncd');
  });

  it('tronque à la longueur maximale', () => {
    expect(sanitizeUserText('abcdef', 3)).toBe('abc');
  });

  it("n'invente rien : le HTML reste du texte (échappé par React au rendu)", () => {
    expect(sanitizeUserText('<b>gras</b>', 100)).toBe('<b>gras</b>');
  });
});

describe('sanitizeSingleLine', () => {
  it('aplatit les sauts de ligne et espaces multiples', () => {
    expect(sanitizeSingleLine('Parc  de la\n Tête   d’Or ', 100)).toBe(
      'Parc de la Tête d’Or'
    );
  });
});

describe('isSafeHttpUrl', () => {
  it('accepte http(s)', () => {
    expect(isSafeHttpUrl('https://example.org/page')).toBe(true);
  });

  it('rejette javascript:, data: et le texte libre', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,x')).toBe(false);
    expect(isSafeHttpUrl('pas une url')).toBe(false);
  });
});
