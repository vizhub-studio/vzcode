import { expect, test } from 'vitest';
import { diff, apply } from '../src/ot.js';

// Round-trips the diff and asserts applying it reproduces the modified state.
const expectRoundTrip = (initialState, modifiedState) => {
  const operation = diff(initialState, modifiedState);
  expect(operation).toBeDefined();
  expect(Array.isArray(operation)).toBe(true);
  expect(operation.length).toBeGreaterThan(0);
  expect(apply(initialState, operation)).toEqual(
    modifiedState,
  );
};

test('diff should handle emoji correctly', () => {
  expectRoundTrip(
    {
      files: {
        'test.js': {
          text: 'Hello 👋 World!',
        },
      },
    },
    {
      files: {
        'test.js': {
          text: 'Hello 👋 World! 🌎',
        },
      },
    },
  );
});

test('diff should handle complex emoji with skin tones', () => {
  expectRoundTrip(
    {
      content: 'User 👨‍💻 is coding',
    },
    {
      content: 'User 👨🏽‍💻 is coding',
    },
  );
});

test('diff should handle emoji in mixed content', () => {
  expectRoundTrip(
    {
      messages: [
        { id: 1, text: 'Hello' },
        { id: 2, text: 'World 🌍' },
      ],
    },
    {
      messages: [
        { id: 1, text: 'Hello 😊' },
        { id: 2, text: 'World 🌍' },
      ],
    },
  );
});
