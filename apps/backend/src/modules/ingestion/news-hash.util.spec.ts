import { normalizeText, computeNewsHash } from './news-hash.util';

describe('news-hash.util', () => {
  describe('normalizeText', () => {
    it('should remove HTML tags', () => {
      expect(normalizeText('<p>Hello <b>World</b></p>')).toBe('hello world');
    });

    it('should normalize whitespace', () => {
      expect(normalizeText('  Hello   World\n  Second  ')).toBe('hello world second');
    });

    it('should lowercase text', () => {
      expect(normalizeText('Hello WORLD')).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
    });
  });

  describe('computeNewsHash', () => {
    it('should be deterministic for same text', () => {
      const hash1 = computeNewsHash('Hello World');
      const hash2 = computeNewsHash('Hello World');
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash for text with different HTML/whitespace', () => {
      const hash1 = computeNewsHash('<p>Hello <b>World</b></p>');
      const hash2 = computeNewsHash('  hello   world  ');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different text', () => {
      const hash1 = computeNewsHash('Hello World');
      const hash2 = computeNewsHash('Goodbye World');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-char hex hash', () => {
      const hash = computeNewsHash('Some news text');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});