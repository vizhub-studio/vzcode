import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { VZCodeContext } from '../src/client/VZCodeContext';
import { AIChatWrapper } from '../src/client/VZSidebar/AIChatWrapper';

const noop = () => {};
const asyncNoop = async () => {};

const makeContext = (
  overrides: Record<string, unknown> = {},
) => ({
  content: null,
  aiChatFocused: false,
  aiChatMode: 'edit',
  aiChatMessage: '',
  currentChatId: 'chat-1',
  selectedChatId: null,
  setSelectedChatId: noop,
  aiErrorMessage: null,
  setAIChatMode: noop,
  getStoredAIPrompt: () => null,
  setAIChatMessage: noop,
  handleSendMessage: asyncNoop,
  setAIErrorMessage: noop,
  navigateMessageHistoryUp: noop,
  navigateMessageHistoryDown: noop,
  resetMessageHistoryNavigation: noop,
  enableMinimalEditFlow: true,
  additionalWidgets: undefined,
  openTab: noop,
  setIsAIChatOpen: noop,
  ...overrides,
});

const render = (value: Record<string, unknown>) =>
  renderToString(
    <VZCodeContext.Provider value={value as any}>
      <AIChatWrapper />
    </VZCodeContext.Provider>,
  );

describe('AIChatWrapper wiring', () => {
  it('renders the empty chat state from context values', () => {
    const html = render(makeContext());
    expect(html).toContain('How can I help you?');
  });

  it('passes chat content through to the message list', () => {
    const content = {
      files: {},
      chats: {
        'chat-1': {
          id: 'chat-1',
          messages: [
            {
              id: 'm1',
              role: 'user',
              content: 'Hello from context',
              timestamp: 0,
            },
          ],
        },
      },
    };
    const html = render(
      makeContext({
        content,
        selectedChatId: 'chat-1',
      }),
    );
    expect(html).toContain('Hello from context');
  });

  it('renders AI errors supplied via context', () => {
    const html = render(
      makeContext({ aiErrorMessage: 'Something broke' }),
    );
    expect(html).toContain('Something broke');
  });
});
