import React, {
  useMemo,
  useContext,
  forwardRef,
} from 'react';
import { timestampToDate } from '@vizhub/viz-utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamingEvent } from '../../types.js';
import { IndividualFileDiff } from './IndividualFileDiff';
import { VZCodeContext } from '../../client/VZCodeContext';
import { DiffView, DiffViewRef } from './DiffView';
import { UnifiedFilesDiff } from '../../utils/fileDiff';
import { enableDiffView } from '../../client/featureFlags';

interface MessageProps {
  id: string;
  role: 'user' | 'assistant';
  content?: string; // For non-streaming messages
  timestamp: number;
  events?: StreamingEvent[]; // For streaming messages
  isActive?: boolean; // Is this the currently streaming message?
  chatId?: string;
  showAdditionalWidgets?: boolean;
  isStreaming?: boolean;
  diffData?: UnifiedFilesDiff;
  model?: string; // The LLM model used for this message (assistant only)
}

export const Message = forwardRef<
  DiffViewRef,
  React.PropsWithChildren<MessageProps>
>(
  (
    {
      id,
      role,
      content,
      timestamp,
      events = [],
      isActive,
      children,
      chatId,
      showAdditionalWidgets = false,
      isStreaming = false,
      diffData,
      model,
    },
    ref,
  ) => {
    const { additionalWidgets, handleSendMessage } =
      useContext(VZCodeContext);

    // Memoize date formatting to avoid repeated computation
    const formattedTime = useMemo(() => {
      return timestampToDate(timestamp).toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      );
    }, [timestamp]);

    // Memoize the className string to avoid recreation
    const messageClassName = useMemo(() => {
      return `ai-chat-message ${role}${isStreaming ? ' streaming' : ''}`;
    }, [role, isStreaming]);

    return (
      <div className={messageClassName}>
        <div className="ai-chat-message-content">
          {/* Model indicator for assistant messages */}
          {role === 'assistant' && model && (
            <div className="model-indicator">{model}</div>
          )}

          {/* Render regular content for non-streaming messages */}
          {content && (
            <Markdown remarkPlugins={[remarkGfm]}>
              {content}
            </Markdown>
          )}

          {/* Render diff view if present */}
          {enableDiffView &&
            diffData &&
            Object.keys(diffData).length > 0 && (
              <DiffView diffData={diffData} ref={ref} />
            )}

          {/* Render events in order for streaming messages */}
          {events.map((event, index) => {
            switch (event.type) {
              case 'text_chunk':
                return (
                  <div
                    key={`text-${index}`}
                    className="text-chunk"
                  >
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {event.content}
                    </Markdown>
                  </div>
                );
              case 'file_complete':
                return (
                  <IndividualFileDiff
                    key={`file-${event.fileName}-${index}`}
                    fileName={event.fileName}
                    beforeContent={
                      event.beforeContent || ''
                    }
                    afterContent={event.afterContent || ''}
                  />
                );
              case 'file_start':
                // File start events are now handled by centralized status logic in MessageList
                return null;
              default:
                return null;
            }
          })}
          {/* Additional widgets are now shown within the "Done" status indicator */}
          {showAdditionalWidgets &&
            additionalWidgets &&
            chatId &&
            !isStreaming && // Only show here for non-streaming messages (completed messages)
            additionalWidgets({
              messageId: id,
              chatId: chatId,
              handleSendMessage,
            })}
          {isActive && children}
        </div>
        <div className="ai-chat-message-time">
          {formattedTime}
        </div>
      </div>
    );
  },
);

Message.displayName = 'Message';
