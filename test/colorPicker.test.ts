import { describe, expect, it } from 'vitest';
import { normalizeOpaqueColorToHex } from '../src/client/VZSidebar/VisualEditor/colorUtils';

describe('color picker value normalization', () => {
  it('supports named and hex colors without losing the RGB value', () => {
    expect(normalizeOpaqueColorToHex('black')).toBe('#000000');
    expect(normalizeOpaqueColorToHex('#ABCDEF')).toBe('#abcdef');
    expect(normalizeOpaqueColorToHex('rgb(17, 34, 51)')).toBe('#112233');
  });
  it('does not commit invalid or transparent colors', () => {
    expect(normalizeOpaqueColorToHex('bad-color')).toBeNull();
    expect(normalizeOpaqueColorToHex('transparent')).toBeNull();
    expect(normalizeOpaqueColorToHex('rgba(0, 0, 0, .5)')).toBeNull();
  });
});
