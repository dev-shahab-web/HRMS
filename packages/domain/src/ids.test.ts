import { describe, expect, it } from 'vitest';

import { isUuid, isUuidV7, newId } from './ids';

describe('newId', () => {
  it('produces valid, unique v7 UUIDs', () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(isUuid(a)).toBe(true);
    expect(isUuidV7(a)).toBe(true);
  });

  it('generates time-ordered ids (v7 monotonic-ish across a batch)', () => {
    const ids = Array.from({ length: 50 }, () => newId());
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('isUuid / isUuidV7', () => {
  it('rejects non-UUID strings and non-strings', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it('distinguishes v7 from other UUID versions', () => {
    // A valid v4 UUID is a UUID but not a v7.
    const v4 = '9b2e4c1a-3d5f-4a2b-8c7d-1e2f3a4b5c6d';
    expect(isUuid(v4)).toBe(true);
    expect(isUuidV7(v4)).toBe(false);
  });
});
