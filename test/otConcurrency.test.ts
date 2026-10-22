import { describe, it, expect } from 'vitest';
import { diff, apply, otType } from '../src/ot.js';

// Two concurrent operations based on the same snapshot are transformed
// against each other and must converge to the same document.
// Convention: opA is transformed with side 'left', opB with side 'right'.
const converge = (
  base: unknown,
  a: unknown,
  b: unknown,
) => {
  const opA = diff(base, a);
  const opB = diff(base, b);
  expect(opA).toBeTruthy();
  expect(opB).toBeTruthy();

  const opAAfterB = otType.transform(opA, opB, 'left');
  const opBAfterA = otType.transform(opB, opA, 'right');

  const resultA = apply(apply(base, opB), opAAfterB);
  const resultB = apply(apply(base, opA), opBAfterA);
  expect(resultA).toEqual(resultB);
  return resultA;
};

describe('OT concurrency (transform)', () => {
  it('converges when two clients insert at the same position', () => {
    converge(
      { files: { f1: { text: 'ab' } } },
      { files: { f1: { text: 'Xab' } } },
      { files: { f1: { text: 'Yab' } } },
    );
  });

  it('converges for edits to different regions of one file', () => {
    converge(
      { files: { f1: { text: 'hello world' } } },
      { files: { f1: { text: 'HELLO world' } } },
      { files: { f1: { text: 'hello WORLD' } } },
    );
  });

  it('converges for edits to different files', () => {
    converge(
      {
        files: {
          f1: { text: 'one' },
          f2: { text: 'two' },
        },
      },
      {
        files: {
          f1: { text: 'one!' },
          f2: { text: 'two' },
        },
      },
      {
        files: {
          f1: { text: 'one' },
          f2: { text: 'two!' },
        },
      },
    );
  });

  it('converges for edits to different object fields', () => {
    converge(
      { config: { margin: { top: 20 }, radius: 10 } },
      { config: { margin: { top: 30 }, radius: 10 } },
      { config: { margin: { top: 20 }, radius: 25 } },
    );
  });

  it('converges for conflicting astral-plane (emoji) inserts', () => {
    converge(
      { files: { f1: { text: '😀 middle 🌎' } } },
      { files: { f1: { text: '😀 START middle 🌎' } } },
      { files: { f1: { text: '😀 middle END 🌎' } } },
    );
    converge(
      { files: { f1: { text: 'a' } } },
      { files: { f1: { text: 'a👋' } } },
      { files: { f1: { text: 'a🚀' } } },
    );
  });

  it('converges for concurrent array inserts', () => {
    converge(
      { messages: [{ id: 1, text: 'a' }] },
      {
        messages: [
          { id: 0, text: 'first' },
          { id: 1, text: 'a' },
        ],
      },
      {
        messages: [
          { id: 1, text: 'a' },
          { id: 2, text: 'second' },
        ],
      },
    );
  });
});

describe('OT compose', () => {
  it('composing two sequential diffs equals one diff', () => {
    const a = { files: { f1: { text: 'one' } } };
    const b = { files: { f1: { text: 'one two' } } };
    const c = { files: { f1: { text: 'one two three' } } };

    const composed = otType.compose(diff(a, b), diff(b, c));
    expect(apply(a, composed)).toEqual(c);
  });

  it('composes astral-plane edits', () => {
    const a = { files: { f1: { text: 'x' } } };
    const b = { files: { f1: { text: 'x👋' } } };
    const c = { files: { f1: { text: 'x👋y' } } };

    const composed = otType.compose(diff(a, b), diff(b, c));
    expect(apply(a, composed)).toEqual(c);
  });
});

describe('OT concurrency fuzz (deterministic)', () => {
  it('converges for random concurrent astral/BMP edits', () => {
    let seed = 987654321;
    const random = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) /
      0x1_0000_0000;
    const alphabet = [
      'a',
      'b',
      'c',
      ' ',
      '😀',
      '👋',
      '🚀',
      'é',
      '👨‍💻',
      '中',
    ];
    const randomChar = () =>
      alphabet[Math.floor(random() * alphabet.length)];
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

    for (let i = 0; i < 300; i++) {
      const baseText = randomString(20);
      const base = {
        files: { f1: { name: 'a.js', text: baseText } },
      };
      const aText = mutate(baseText);
      const bText = mutate(baseText);
      // A no-op mutation yields an empty diff; skip those iterations.
      if (aText === baseText || bText === baseText)
        continue;
      const a = {
        files: { f1: { name: 'a.js', text: aText } },
      };
      const b = {
        files: { f1: { name: 'a.js', text: bText } },
      };
      converge(base, a, b);
    }
  });
});
