import React, { useMemo, forwardRef } from 'react';
import { timestampToDate } from '@vizhub/viz-utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IndividualFileDiff } from './IndividualFileDiff';
import { DiffView, DiffViewRef } from './DiffView';
import type { MessageProps } from '../props';

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
      additionalWidgets,
      handleSendMessage,
      enableDiffView = true,
      onOpenFile,
    },
    ref,
  ) => {
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
              <DiffView
                diffData={diffData}
                ref={ref}
                onOpenFile={onOpenFile}
              />
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
