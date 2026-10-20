import { describe, it, expect } from 'vitest';
import { diff, apply } from '../src/ot.js';

// Deterministic PRNG so the fuzz test is reproducible (never flaky).
const makeRandom = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x1_0000_0000;
};

// A mix of ASCII, BMP accented characters, combining marks, single astral
// code points and multi-code-point emoji sequences (ZWJ, skin tone, flags).
const ALPHABET = [
  'a',
  'b',
  'c',
  ' ',
  '\n',
  'é',
  '中',
  'e\u0301',
  '👋',
  '😀',
  '🚀',
  '🌍',
  '🏽',
  '👨‍💻',
  '👨‍👩‍👧',
  '🇺🇸',
];

describe('OT unicode fuzz (deterministic)', () => {
  it('round-trips random astral/BMP text edits', () => {
    const random = makeRandom(123456789);
    const randomChar = () =>
      ALPHABET[Math.floor(random() * ALPHABET.length)];
    const randomString = (maxCodePoints: number) => {
      let value = '';
      const length = Math.floor(random() * maxCodePoints);
      for (let i = 0; i < length; i++)
        value += randomChar();
      return value;
    };
    const mutate = (value: string) => {
      const chars = Array.from(value);
      const mutations = Math.floor(random() * 4);
      for (let i = 0; i < mutations; i++) {
        const choice = random();
        const position = Math.floor(
          random() * (chars.length + 1),
        );
        if (choice < 0.4) {
          chars.splice(position, 0, randomChar());
        } else if (choice < 0.7 && chars.length > 0) {
          chars.splice(
            Math.min(position, chars.length - 1),
            1,
          );
        } else if (chars.length > 0) {
          chars[Math.min(position, chars.length - 1)] =
            randomChar();
        }
      }
      return chars.join('');
    };

    for (let i = 0; i < 500; i++) {
      const oldText = randomString(24);
      const newText =
        random() < 0.15
          ? randomString(24)
          : mutate(oldText);
      if (oldText === newText) continue;
      const before = {
        files: {
          f1: { name: 'a.js', text: oldText },
          f2: { name: 'b.css', text: oldText },
        },
        chats: {
          c1: {
            messages: [
              { id: 'm1', role: 'user', content: oldText },
            ],
          },
        },
      };
      const after = {
        files: {
          f1: { name: 'a.js', text: newText },
          f2: { name: 'b.css', text: newText },
        },
        chats: {
          c1: {
            messages: [
              { id: 'm1', role: 'user', content: newText },
            ],
          },
        },
      };

      const op = diff(before, after);
      expect(op).toBeTruthy();
      expect(apply(before, op)).toEqual(after);
    }
  });
});
