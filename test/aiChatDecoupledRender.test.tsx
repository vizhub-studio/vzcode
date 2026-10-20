import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AIChat } from '../src/llm-streaming-ui/components/index';

const noop = () => {};

describe('AIChat (decoupled from VZCode context)', () => {
  it('renders the empty state using props alone', () => {
    const html = renderToString(
      <AIChat
        content={null}
        aiChatMode="edit"
        setAIChatMode={noop}
        aiChatMessage=""
        setAIChatMessage={noop}
        aiErrorMessage={null}
        setAIErrorMessage={noop}
        currentChatId="chat-1"
        selectedChatId={null}
        setSelectedChatId={noop}
        handleSendMessage={async () => {}}
        navigateMessageHistoryUp={noop}
        navigateMessageHistoryDown={noop}
        resetMessageHistoryNavigation={noop}
      />,
    );
    expect(html).toContain('How can I help you?');
  });

  it('renders an error message passed via props', () => {
    const html = renderToString(
      <AIChat
        content={null}
        aiChatMode="edit"
        setAIChatMode={noop}
        aiChatMessage=""
        setAIChatMessage={noop}
        aiErrorMessage="Something went wrong"
        setAIErrorMessage={noop}
        currentChatId="chat-1"
        selectedChatId={null}
        setSelectedChatId={noop}
        handleSendMessage={async () => {}}
        navigateMessageHistoryUp={noop}
        navigateMessageHistoryDown={noop}
        resetMessageHistoryNavigation={noop}
      />,
    );
    expect(html).toContain('Something went wrong');
  });
});
