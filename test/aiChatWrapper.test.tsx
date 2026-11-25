import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { VZCodeContext } from '../src/client/VZCodeContext';
import { AIChatWrapper } from '../src/client/VZSidebar/AIChatWrapper';
import { ChatInput } from '../src/llm-streaming-ui/components/ChatInput';

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
  it('renders model choices only for an opted-in catalog', () => {
    const model = { id: 'model-a', label: 'Model A' };
    expect(
      render(
        makeContext({
          aiChatModelConfig: {
            defaultModel: model.id,
            models: [
              model,
              { id: 'model-b', label: 'Model B' },
            ],
          },
          selectedAIChatModel: model.id,
          setSelectedAIChatModel: noop,
        }),
      ),
    ).toContain('aria-label="AI chat model"');
    expect(
      render(
        makeContext({
          aiChatModelConfig: { defaultModel: model.id },
          selectedAIChatModel: model.id,
        }),
      ),
    ).not.toContain('aria-label="AI chat model"');
  });

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

  it('renders the host voice control through the VZCode context without a flag', () => {
    const callbacks: Array<Record<string, unknown>> = [];
    const html = render(
      makeContext({
        aiChatMessage: 'Keep this text',
        renderChatVoiceInput: (
          props: Record<string, unknown>,
        ) => {
          callbacks.push(props);
          return (
            <button
              type="button"
              aria-label="Host microphone"
            >
              Mic
            </button>
          );
        },
      }),
    );
    expect(html).toContain('Host microphone');
    expect(html).toContain('Keep this text');
    expect(html).not.toContain('Start voice typing');
    expect(callbacks[0]).toMatchObject({
      value: 'Keep this text',
    });
    expect(typeof callbacks[0].onChange).toBe('function');
    expect(typeof callbacks[0].onBusyChange).toBe(
      'function',
    );
    expect(typeof callbacks[0].onPreviewChange).toBe(
      'function',
    );
  });

  it('prefers the host control over the legacy microphone even if enabled', () => {
    const html = renderToString(
      <ChatInput
        aiChatMessage="Draft"
        setAIChatMessage={noop}
        onSendMessage={noop}
        focused={false}
        aiChatMode="edit"
        setAIChatMode={noop}
        navigateMessageHistoryUp={noop}
        navigateMessageHistoryDown={noop}
        resetMessageHistoryNavigation={noop}
        enableVoiceInput
        renderChatVoiceInput={() => (
          <button type="button" aria-label="App microphone">
            Speak
          </button>
        )}
      />,
    );
    expect(html).toContain('App microphone');
    expect(html).not.toContain('Start voice typing');
    expect(html).toContain('Send');
  });

  it('renders AI errors supplied via context', () => {
    const html = render(
      makeContext({ aiErrorMessage: 'Something broke' }),
    );
    expect(html).toContain('Something broke');
  });
});
