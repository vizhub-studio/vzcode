import { describe, test, expect, vi } from 'vitest';
import {
  AI_CHAT_BUTTON_EVENT,
  emitAIChatButtonEvent,
  handleAIChatButtonClick,
} from '../src/client/aiChatButtonEvent';

describe('aiChatButtonEvent', () => {
  test('emits the named event with host-facing detail', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    target.addEventListener(AI_CHAT_BUTTON_EVENT, listener);

    emitAIChatButtonEvent(AI_CHAT_BUTTON_EVENT, target);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(AI_CHAT_BUTTON_EVENT);
    expect(event.detail).toEqual({
      source: 'vzcode-sidebar',
    });
  });

  test('with aiChatButtonEvent: emits and does not open built-in chat', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const openAIChat = vi.fn();
    target.addEventListener('custom-ai', listener);

    handleAIChatButtonClick({
      aiChatButtonEvent: 'custom-ai',
      target,
      openAIChat,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(openAIChat).not.toHaveBeenCalled();
  });

  test('without aiChatButtonEvent: opens built-in chat and emits nothing', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const openAIChat = vi.fn();
    target.addEventListener(AI_CHAT_BUTTON_EVENT, listener);

    handleAIChatButtonClick({
      target,
      openAIChat,
    });

    expect(openAIChat).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
