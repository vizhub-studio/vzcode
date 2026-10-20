import { describe, it, expect } from 'vitest';
import { diff, apply } from '../src/ot.js';

// A change is lossless if applying the diff of (a, b) to a yields b.
const roundTrip = (a: unknown, b: unknown) => {
  const op = diff(a, b);
  expect(op).toBeTruthy();
  expect(apply(a, op)).toEqual(b);
};

describe('OT round-trip (diff then apply)', () => {
  it('round-trips a text edit in a file', () => {
    roundTrip(
      { files: { f1: { name: 'a.js', text: 'hello' } } },
      {
        files: {
          f1: { name: 'a.js', text: 'hello world' },
        },
      },
    );
  });

  it('round-trips nested object property edits', () => {
    roundTrip(
      {
        config: {
          margin: { top: 20, left: 60 },
          pointRadius: 10,
        },
      },
      {
        config: {
          margin: { top: 30, left: 60 },
          pointRadius: 12,
        },
      },
    );
  });

  it('round-trips adding and removing file keys', () => {
    const before = {
      files: { f1: { name: 'a.js', text: 'x' } },
    };
    const after = {
      files: {
        f1: { name: 'a.js', text: 'x' },
        f2: { name: 'b.js', text: 'y' },
      },
    };
    roundTrip(before, after);
    roundTrip(after, before);
  });

  it('round-trips unicode text on the basic multilingual plane', () => {
    roundTrip(
      { files: { f1: { text: 'café naïve' } } },
      { files: { f1: { text: 'café naïveté' } } },
    );
  });

  it('round-trips astral-plane emoji text', () => {
    roundTrip(
      { files: { f1: { text: 'Hello 👋 World!' } } },
      { files: { f1: { text: 'Hello 👋 World! 🌎' } } },
    );
    // Replace an emoji with another emoji.
    roundTrip(
      { files: { f1: { text: 'a👋b' } } },
      { files: { f1: { text: 'a🚀b' } } },
    );
    // Delete an emoji.
    roundTrip(
      { files: { f1: { text: 'Hello 👋 World!' } } },
      { files: { f1: { text: 'Hello World!' } } },
    );
  });

  it('round-trips multi-code-point emoji sequences', () => {
    // Zero-width-joiner sequence (man technologist).
    roundTrip(
      { files: { f1: { text: 'User 👨‍💻 is coding' } } },
      { files: { f1: { text: 'User 👨🏽‍💻 is coding' } } },
    );
    // Family sequence.
    roundTrip(
      { files: { f1: { text: 'x 👨‍👩‍👧 y' } } },
      { files: { f1: { text: 'x 👨‍👩‍👧‍👦 y' } } },
    );
  });

  it('round-trips text with astral and BMP characters interleaved', () => {
    roundTrip(
      {
        files: { f1: { text: '😀 one two 😀 three four' } },
      },
      {
        files: {
          f1: { text: '😀 ONE two 😀 THREE four!' },
        },
      },
    );
    roundTrip(
      { messages: [{ id: 1, text: 'Hello 👋' }] },
      {
        messages: [
          { id: 1, text: 'Hello 👋 there' },
          { id: 2, text: 'Bye 🚀' },
        ],
      },
    );
  });

  it('round-trips array edits', () => {
    roundTrip(
      { messages: [{ id: 1, text: 'Hello' }] },
      {
        messages: [
          { id: 1, text: 'Hello there' },
          { id: 2, text: 'Goodbye' },
        ],
      },
    );
  });

  it('round-trips boolean and numeric property changes', () => {
    roundTrip(
      { isInteracting: false, runId: 1 },
      { isInteracting: true, runId: 2 },
    );
  });
});
