import {
  useRef,
  useEffect,
  memo,
  useState,
} from 'react';
import { Message } from './Message';
import { TypingIndicator } from './TypingIndicator';
import { ThinkingScratchpad } from './ThinkingScratchpad';
import { AIEditingStatusIndicator } from './FileEditingIndicator';
import { VizChatMessage } from '@vizhub/viz-types';
import { ExtendedVizChatMessage } from '../../types.js';
import { DiffViewRef } from './DiffView.js';
import type {
  AdditionalChatWidgets,
  SendChatMessage,
} from '../types';

const MessageListComponent = ({
  messages,
  isLoading,
  chatId, // Add chatId prop
  aiScratchpad, // Add aiScratchpad prop
  currentStatus, // Add current status prop
  model, // Add model prop
  onNewEvent,
  onJumpToLatest,
  beforeRender,
  afterRender,
  additionalWidgets,
  handleSendMessage,
  onOpenDiffFile,
}: {
  messages: VizChatMessage[];
  isLoading: boolean;
  chatId?: string; // Add chatId to the type
  aiScratchpad?: string; // Add aiScratchpad to the type
  currentStatus?: string; // Add current status to the type
  model?: string; // Add model to the type
  onNewEvent: (targetElement?: HTMLElement) => void;
  onJumpToLatest: (targetElement?: HTMLElement) => void;
  beforeRender: () => number;
  afterRender: (prevScrollHeight: number) => void;
  additionalWidgets?: AdditionalChatWidgets;
  handleSendMessage?: SendChatMessage;
  onOpenDiffFile?: (fileName: string) => void;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const diffViewRef = useRef<DiffViewRef>(null);

  // Track previous loading state to detect when AI generation completes
  const [prevIsLoading, setPrevIsLoading] =
    useState(isLoading);

  // Auto-scroll when messages change
  useEffect(() => {
    // Get scroll height before render for anchoring
    const prevScrollHeight = beforeRender();

    // Determine if we should scroll to a specific diff or to the bottom
    const lastMessageHasDiff =
      messages.length > 0 &&
      (messages[messages.length - 1] as any).diffData;

    let targetElement: HTMLElement | null = null;
    if (lastMessageHasDiff && diffViewRef.current) {
      targetElement =
        diffViewRef.current.getFirstHunkElement();
    }

    // Trigger auto-scroll if enabled
    onNewEvent(targetElement);

    // Adjust scroll position after render for anchoring
    afterRender(prevScrollHeight);
  }, [messages, onNewEvent, beforeRender, afterRender]);

  // Scroll to bottom when AI generation completes (loading changes from true to false)
  useEffect(() => {
    // If AI was generating and now it's finished, force scroll to bottom
    if (prevIsLoading && !isLoading) {
      // Force jump to latest regardless of current auto-scroll state
      onJumpToLatest();
    }

    setPrevIsLoading(isLoading);
  }, [isLoading, prevIsLoading, onJumpToLatest]);

  // Check if AI generation has started (last message is from assistant)
  const lastMessage = messages[messages.length - 1];
  const aiGenerationStarted =
    lastMessage?.role === 'assistant' &&
    lastMessage.content !== '';

  // Show typing indicator only when loading and AI generation hasn't started yet
  const showTypingIndicator =
    isLoading && !aiGenerationStarted;

  // Show thinking scratchpad when AI is thinking (has scratchpad content)
  const showThinkingScratchpad = Boolean(
    aiScratchpad && aiScratchpad.trim(),
  );

  // Determine the single, most relevant status to display with priority:
  // 1. Active file editing status from streaming events
  // 2. General AI status from currentStatus
  const getConsolidatedStatus = () => {
    // Check if there's an active streaming message with file editing
    if (lastMessage && lastMessage.role === 'assistant') {
      const extendedMsg =
        lastMessage as ExtendedVizChatMessage;
      if (
        extendedMsg.streamingEvents &&
        extendedMsg.streamingEvents.length > 0
      ) {
        // Look for active file editing (file_start without corresponding file_complete)
        const fileStates = new Map<string, boolean>();

        extendedMsg.streamingEvents.forEach((event) => {
          if (event.type === 'file_start') {
            fileStates.set(event.fileName, false); // Mark as editing
          } else if (event.type === 'file_complete') {
            fileStates.set(event.fileName, true); // Mark as complete
          }
        });

        // Find the first file that's still being edited
        for (const [fileName, isComplete] of fileStates) {
          if (!isComplete) {
            return {
              status: `Editing ${fileName}...`,
              fileName,
            };
          }
        }
      }
    }

    // Fall back to general AI status if no active file editing
    if (currentStatus) {
      return { status: currentStatus };
    }

    return null;
  };

  const consolidatedStatus = getConsolidatedStatus();

  // Show consolidated status indicator when there's a status to display
  const showConsolidatedStatusIndicator = Boolean(
    consolidatedStatus,
  );

  // Find the most recent assistant message index
  const lastAssistantMessageIndex = messages
    .map((m, i) => (m.role === 'assistant' ? i : -1))
    .filter((i) => i !== -1)
    .pop();

  return (
    <div
      className="ai-chat-messages"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((msg, index) => {
        const isLastMessage = index === messages.length - 1;
        // Cast to extended message to check for streaming events
        const extendedMsg = msg as ExtendedVizChatMessage;

        // Check if this is a streaming message
        const isStreamingMessage =
          !!extendedMsg.isProgressive;

        // Only show additionalWidgets for the most recent assistant message
        const showAdditionalWidgets =
          msg.role === 'assistant' &&
          index === lastAssistantMessageIndex;

        // Use Message for all messages now
        return (
          <Message
            key={msg.id}
            id={msg.id}
            role={msg.role}
            content={
              isStreamingMessage ? undefined : msg.content
            }
            timestamp={msg.timestamp}
            events={
              isStreamingMessage
                ? extendedMsg.streamingEvents || []
                : []
            }
            isActive={index === lastAssistantMessageIndex}
            chatId={chatId}
            showAdditionalWidgets={showAdditionalWidgets}
            isStreaming={isStreamingMessage}
            diffData={(msg as any).diffData}
            model={
              msg.role === 'assistant' ? model : undefined
            }
            additionalWidgets={additionalWidgets}
            handleSendMessage={handleSendMessage}
            onOpenDiffFile={onOpenDiffFile}
            ref={
              isLastMessage && (msg as any).diffData
                ? diffViewRef
                : null
            }
          >
            {isStreamingMessage &&
              showThinkingScratchpad && (
                <ThinkingScratchpad
                  content={aiScratchpad || ''}
                  isVisible={showThinkingScratchpad}
                />
              )}

            {isStreamingMessage &&
              showConsolidatedStatusIndicator && (
                <AIEditingStatusIndicator
                  status={consolidatedStatus?.status || ''}
                  fileName={consolidatedStatus?.fileName}
                  additionalWidgets={
                    consolidatedStatus?.status === 'Done' &&
                    showAdditionalWidgets &&
                    additionalWidgets &&
                    chatId
                      ? additionalWidgets({
                          messageId: msg.id,
                          chatId: chatId,
                          handleSendMessage,
                        })
                      : undefined
                  }
                />
              )}

            {isStreamingMessage && showTypingIndicator && (
              <TypingIndicator />
            )}
          </Message>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
};

export const MessageList = memo(MessageListComponent);
