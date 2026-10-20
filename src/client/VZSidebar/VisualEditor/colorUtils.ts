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

export function hclChannelsToHex(
  channels: HclChannels,
  fallback: string,
): string {
  const next = hcl(channels.h, channels.c, channels.l);
  return next.displayable() ? next.formatHex() : fallback;
}
