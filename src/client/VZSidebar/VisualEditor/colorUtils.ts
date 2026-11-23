import { color, hcl } from 'd3-color';

export type HclChannels = {
  h: number;
  c: number;
  l: number;
};

export function toHclChannels(value: string): HclChannels {
  const parsed = color(value);
  const result = parsed ? hcl(parsed) : hcl('black');
  return {
    h: Number.isFinite(result.h) ? result.h : 0,
    c: Number.isFinite(result.c) ? result.c : 0,
    l: Number.isFinite(result.l) ? result.l : 0,
  };
}

/**
 * Coerces a widget value to a finite number, falling back when
 * the stored value is not numeric (widget values may be strings or
 * booleans for other widget types).
 */
export function coerceChannelNumber(
  value: unknown,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

export function hclChannelsToHex(
  channels: HclChannels,
  fallback: string,
): string {
  const next = hcl(channels.h, channels.c, channels.l);
  return next.displayable() ? next.formatHex() : fallback;
}

/** Normalize any opaque d3-supported CSS color to a hex string.
 * Reject invalid/transparent values rather than writing an unusable config.
 */
export function normalizeOpaqueColorToHex(value: string): string | null {
  const parsed = color(value);
  return parsed && parsed.opacity === 1
    ? parsed.formatHex().toLowerCase()
    : null;
}
