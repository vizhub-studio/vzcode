import {
  describe,
  it,
  expect,
  vi,
  afterEach,
} from 'vitest';
import { shouldTriggerRun } from '../src/client/shouldTriggerRun';

// `shouldTriggerRun` reads `navigator.userAgent`; stub it per test.
const keyEvent = (
  overrides: Partial<KeyboardEvent>,
): KeyboardEvent => overrides as KeyboardEvent;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shouldTriggerRun (keyboard predicate)', () => {
  it('non-Mac: triggers on Ctrl shortcuts and function keys', () => {
    vi.stubGlobal('navigator', { userAgent: 'Linux' });
    expect(
      shouldTriggerRun(
        keyEvent({ ctrlKey: true, key: 's' }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerRun(
        keyEvent({ ctrlKey: true, key: 'Enter' }),
      ),
    ).toBe(true);
    expect(shouldTriggerRun(keyEvent({ key: 'F5' }))).toBe(
      true,
    );
    expect(
      shouldTriggerRun(
        keyEvent({ shiftKey: true, key: 'Enter' }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerRun(
        keyEvent({ altKey: true, key: 'Enter' }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerRun(
        keyEvent({
          ctrlKey: true,
          shiftKey: true,
          key: 'b',
        }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerRun(
        keyEvent({
          ctrlKey: true,
          shiftKey: true,
          key: 'B',
        }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerRun(
        keyEvent({
          ctrlKey: true,
          shiftKey: true,
          key: 'F10',
        }),
      ),
    ).toBe(true);
    expect(shouldTriggerRun(keyEvent({ key: 'F8' }))).toBe(
      true,
    );
    expect(shouldTriggerRun(keyEvent({ key: 'F9' }))).toBe(
      true,
    );
  });

  it('non-Mac: does not trigger on Meta, Ctrl+R, or plain keys', () => {
    vi.stubGlobal('navigator', { userAgent: 'Linux' });
    expect(
      shouldTriggerRun(
        keyEvent({ metaKey: true, key: 's' }),
      ),
    ).toBe(false);
    expect(
      shouldTriggerRun(
        keyEvent({ ctrlKey: true, key: 'r' }),
      ),
    ).toBe(false);
    expect(shouldTriggerRun(keyEvent({ key: 'a' }))).toBe(
      false,
    );
    expect(
      shouldTriggerRun(keyEvent({ key: 'Enter' })),
    ).toBe(false);
  });

  it('Mac: uses Meta instead of Ctrl', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    expect(
      shouldTriggerRun(
        keyEvent({ metaKey: true, key: 's' }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerRun(
        keyEvent({ metaKey: true, key: 'Enter' }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerRun(
        keyEvent({ ctrlKey: true, key: 's' }),
      ),
    ).toBe(false);
  });
});
