import { describe, it, expect } from 'vitest';
import { isValidVideoId, isPathInside } from '../validateVideoId.js';

describe('isValidVideoId', () => {
  it('accepts a canonical 11-char YouTube id', () => {
    expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidVideoId('-lzHszPWkgM')).toBe(true);
  });
  it('rejects traversal, wrong length, and non-strings', () => {
    expect(isValidVideoId('../../etc/passwd')).toBe(false);
    expect(isValidVideoId('short')).toBe(false);
    expect(isValidVideoId('waytoolongforanid')).toBe(false);
    expect(isValidVideoId('bad/slash..')).toBe(false);
    expect(isValidVideoId(undefined)).toBe(false);
    expect(isValidVideoId(42)).toBe(false);
  });
});

describe('isPathInside', () => {
  it('accepts a child of the parent dir', () => {
    expect(isPathInside('/data/downloads/x.mp3', '/data/downloads')).toBe(true);
  });
  it('rejects an escape via ..', () => {
    expect(isPathInside('/data/downloads/../secret', '/data/downloads')).toBe(false);
  });
});
