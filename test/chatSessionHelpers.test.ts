import { describe, expect, it } from 'vitest';
import {
  shouldReuseChatId,
  userMessageHistory,
} from '../src/client/VZCodeContext/chatSessionHelpers';

describe('AI chat session behavior', () => {
  it('reuses the current chat only for retry and undo', () => {
    expect(shouldReuseChatId()).toBe(false);
    expect(shouldReuseChatId({ isRetry: 'true' })).toBe(
      true,
    );
    expect(shouldReuseChatId({ isUndo: 'true' })).toBe(
      true,
    );
    expect(shouldReuseChatId({ isRetry: 'false' })).toBe(
      false,
    );
    expect(shouldReuseChatId({ isRetry: 'TRUE' })).toBe(
      false,
    );
  });
  it('maintains chronological user prompt history', () => {
    const messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: 'second' },
    ];
    expect(userMessageHistory(messages)).toEqual([
      'first',
      'second',
    ]);
    expect(userMessageHistory([])).toEqual([]);
    expect(userMessageHistory()).toEqual([]);
    expect(userMessageHistory(null)).toEqual([]);
    expect(messages).toHaveLength(3);
  });
});
