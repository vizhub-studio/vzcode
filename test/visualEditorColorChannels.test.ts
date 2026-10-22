import { describe, expect, it } from 'vitest';
import {
  coerceChannelNumber,
  toHclChannels,
} from '../src/client/VZSidebar/VisualEditor/colorUtils';

describe('coerceChannelNumber', () => {
  it('passes through finite numbers, including 0 and negatives', () => {
    expect(coerceChannelNumber(42, 7)).toBe(42);
    expect(coerceChannelNumber(0, 7)).toBe(0);
    expect(coerceChannelNumber(-3.5, 7)).toBe(-3.5);
  });

  it('falls back for non-finite numbers', () => {
    expect(coerceChannelNumber(NaN, 7)).toBe(7);
    expect(coerceChannelNumber(Infinity, 7)).toBe(7);
    expect(coerceChannelNumber(-Infinity, 7)).toBe(7);
  });

  it('falls back for non-number widget values', () => {
    expect(coerceChannelNumber('3', 7)).toBe(7);
    expect(coerceChannelNumber('abc', 7)).toBe(7);
    expect(coerceChannelNumber('', 7)).toBe(7);
    expect(coerceChannelNumber(true, 7)).toBe(7);
    expect(coerceChannelNumber(false, 7)).toBe(7);
    expect(coerceChannelNumber(null, 7)).toBe(7);
    expect(coerceChannelNumber(undefined, 7)).toBe(7);
    expect(coerceChannelNumber({}, 7)).toBe(7);
    expect(coerceChannelNumber([], 7)).toBe(7);
  });

  it('returns the exact fallback value', () => {
    const fallback = 123.456;
    expect(
      coerceChannelNumber('not-a-number', fallback),
    ).toBe(fallback);
  });

  it('is compatible with toHclChannels fallbacks', () => {
    const channels = toHclChannels('not-a-color');
    expect(coerceChannelNumber(undefined, channels.h)).toBe(
      channels.h,
    );
    expect(coerceChannelNumber('12', channels.c)).toBe(
      channels.c,
    );
    expect(coerceChannelNumber(channels.l, 0)).toBe(
      channels.l,
    );
  });
});
