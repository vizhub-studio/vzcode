import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VizChatMessage } from '@vizhub/viz-types';
import { AIChat } from '../src/llm-streaming-ui/components/index';
import { MessageList } from '../src/llm-streaming-ui/components/MessageList';
import { Message } from '../src/llm-streaming-ui/components/Message';
import type { AIChatProps } from '../src/llm-streaming-ui/types';

const chatProps = (): AIChatProps => ({
  content: null,
  aiChatFocused: false,
  aiChatMode: 'edit',
  aiChatMessage: '',
  currentChatId: 'new-chat',
  selectedChatId: null,
  setSelectedChatId: vi.fn(),
  aiErrorMessage: null,
  setAIChatMode: vi.fn(),
  setAIChatMessage: vi.fn(),
  handleSendMessage: vi.fn(async () => ({})),
  setAIErrorMessage: vi.fn(),
  navigateMessageHistoryUp: vi.fn(),
  navigateMessageHistoryDown: vi.fn(),
  resetMessageHistoryNavigation: vi.fn(),
});

describe('standalone AI chat UI', () => {
  it('renders an empty chat without any VZCode context provider', () => {
    const markup = renderToStaticMarkup(
      createElement(AIChat, chatProps()),
    );
    expect(markup).toContain('Edit with AI');
    expect(markup).toContain('How can I help you?');
  });

  it('passes additional widgets through the last assistant message', () => {
    const renderWidgets = vi.fn(
      ({ messageId }: { messageId: string }) =>
        createElement('button', null, 'Action for ' + messageId),
    );
    const messages = [
      { id: 'user-1', role: 'user', content: 'Make it blue', timestamp: 1 },
      { id: 'assistant-1', role: 'assistant', content: 'Done', timestamp: 2 },
      { id: 'assistant-2', role: 'assistant', content: 'Updated', timestamp: 3 },
    ] as VizChatMessage[];
    const send = vi.fn(async () => undefined);
    const markup = renderToStaticMarkup(
      createElement(MessageList, {
        messages,
        isLoading: false,
        chatId: 'chat-1',
        onNewEvent: vi.fn(),
        onJumpToLatest: vi.fn(),
        beforeRender: () => 0,
        afterRender: vi.fn(),
        additionalWidgets: renderWidgets,
        handleSendMessage: send,
      }),
    );
    expect(markup).toContain('Action for assistant-2');
    expect(markup).not.toContain('Action for assistant-1');
    expect(renderWidgets).toHaveBeenCalledTimes(1);
    expect(renderWidgets).toHaveBeenCalledWith({
      messageId: 'assistant-2',
      chatId: 'chat-1',
      handleSendMessage: send,
    });
  });

  it('does not render completion widgets for streaming messages', () => {
    const widgets = vi.fn(() => createElement('button', null, 'Approve'));
    const markup = renderToStaticMarkup(
      createElement(Message, {
        id: 'assistant-1',
        role: 'assistant',
        timestamp: 2,
        chatId: 'chat-1',
        showAdditionalWidgets: true,
        isStreaming: true,
        additionalWidgets: widgets,
      }),
    );
    expect(widgets).not.toHaveBeenCalled();
    expect(markup).not.toContain('Approve');
  });
});
