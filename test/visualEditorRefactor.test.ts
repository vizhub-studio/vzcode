import { describe, expect, it } from 'vitest';
import { getEditablePropertyValue, setNestedProperty } from '../src/client/VZSidebar/VisualEditor/utils';
import { hclChannelsToHex, toHclChannels } from '../src/client/VZSidebar/VisualEditor/colorUtils';

describe('visual-editor shared path semantics', () => {
  const values = { margin: { left: 10 }, enabled: false };
  it('reads existing nested and falsy values', () => {
    expect(getEditablePropertyValue(values, 'margin.left')).toEqual({ found: true, value: 10 });
    expect(getEditablePropertyValue(values, 'enabled')).toEqual({ found: true, value: false });
    expect(setNestedProperty(values, 'margin.left', 30).margin).toEqual({ left: 30 });
    expect(values.margin.left).toBe(10);
  });
  it('rejects missing, array, and unsafe paths consistently', () => {
    for (const path of ['missing', 'margin.missing', '__proto__', 'margin.constructor', 'margin..left', 'margin.']) {
      expect(getEditablePropertyValue(values, path).found).toBe(false);
    }
    expect(getEditablePropertyValue({ items: [10] }, 'items.0').found).toBe(false);
    expect(() => setNestedProperty(values, 'margin.__proto__', 1)).toThrow();
  });
});
describe('color control conversion', () => {
  it('keeps invalid and out-of-gamut edits from replacing the current color', () => {
    const channels = toHclChannels('#222222');
    expect(Object.values(channels).every(Number.isFinite)).toBe(true);
    expect(hclChannelsToHex({ h: 180, c: 10000, l: 50 }, '#123456')).toBe('#123456');
    expect(hclChannelsToHex(toHclChannels('#ff0000'), '#000000')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
