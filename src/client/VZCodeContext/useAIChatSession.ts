import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { VZCodeProviderProps } from './types';
import {
  shouldReuseChatId,
  userMessageHistory,
} from './chatSessionHelpers';

type AIChatSessionOptions = Pick<
  VZCodeProviderProps,
  | 'content'
  | 'submitOperation'
  | 'aiChatEndpoint'
  | 'aiChatOptions'
  | 'autoForkAndRetryAI'
  | 'handleChatError'
  | 'onAIChatMessageSubmitted'
> & { aiChatMode: 'ask' | 'edit' };

/**
 * Owns the built-in AI chat request, retry, history and draft lifecycle.
 * The parent provider continues exposing the same VZCodeContextValue.
 */
export function useAIChatSession({
  content,
  submitOperation,
  aiChatMode,
  aiChatEndpoint,
  aiChatOptions,
  autoForkAndRetryAI,
  handleChatError,
  onAIChatMessageSubmitted,
}: AIChatSessionOptions) {
  const [aiChatMessage, setAIChatMessage] = useState('');

  const DEBUG = false;

  // Compute isLoading based on the current chat's aiStatus
  // Chat ID changes with each new user message (but not for retry/undo)
  const [currentChatId, setCurrentChatId] = useState(() =>
    uuidv4(),
  );
  const [selectedChatId, setSelectedChatId] = useState<
    string | null
  >(null);

  // Use selectedChatId if available, otherwise use currentChatId for backward compatibility
  const activeChatId = selectedChatId || currentChatId;
  const currentChat = content?.chats?.[activeChatId];

  // Session-local navigation, derived from the current ShareDB chat.
  const messageHistory = useMemo(
    () => userMessageHistory(currentChat?.messages),
    [currentChat?.messages],
  );

  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDraft, setCurrentDraft] = useState('');

  const [aiErrorMessage, setAIErrorMessageState] = useState<
    string | null
  >(null);

  // Create the combined setAIErrorMessage function that calls both state setter and external callback
  const setAIErrorMessage = useCallback(
    (error: string | null, message?: string) => {
      setAIErrorMessageState(error);
      if (error && handleChatError) {
        handleChatError(error, message);
      }
    },
    [handleChatError],
  );

  // Phase 5: Restore the prompt into the chat input when the server
  // populates `currentChatDraft` (e.g. after Undo), then clear it so it
  // is applied exactly once.
  useEffect(() => {
    const draft = (content as any)?.currentChatDraft;
    if (typeof draft === 'string' && draft.trim()) {
      setAIChatMessage(draft);
      submitOperation((currentContent) => {
        const next: any = { ...currentContent };
        next.currentChatDraft = undefined;
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(content as any)?.currentChatDraft]);

  // Message history navigation functions
  const navigateMessageHistoryUp = useCallback(() => {
    if (messageHistory.length === 0) return;

    // If we're not navigating history, save current draft
    if (historyIndex === -1) {
      setCurrentDraft(aiChatMessage);
    }

    const newIndex =
      historyIndex < messageHistory.length - 1
        ? historyIndex + 1
        : historyIndex;
    setHistoryIndex(newIndex);
    setAIChatMessage(
      messageHistory[messageHistory.length - 1 - newIndex],
    );
  }, [messageHistory, historyIndex, aiChatMessage]);

  const navigateMessageHistoryDown = useCallback(() => {
    if (historyIndex === -1) return;

    const newIndex = historyIndex - 1;
    if (newIndex === -1) {
      // Return to draft
      setHistoryIndex(-1);
      setAIChatMessage(currentDraft);
      setCurrentDraft('');
    } else {
      setHistoryIndex(newIndex);
      setAIChatMessage(
        messageHistory[
          messageHistory.length - 1 - newIndex
        ],
      );
    }
  }, [messageHistory, historyIndex, currentDraft]);

  const resetMessageHistoryNavigation = useCallback(() => {
    if (historyIndex !== -1) {
      setHistoryIndex(-1);
      setCurrentDraft('');
    }
  }, [historyIndex]);

  const handleSendMessage = useCallback(
    async (
      messageToSend?: string,
      options?: Record<string, string>,
    ) => {
      DEBUG &&
        console.log(
          'AIChat: handleSendMessage called with:',
          messageToSend,
          'aiChatMessage:',
          aiChatMessage,
        );
      const messageContent = messageToSend || aiChatMessage;

      if (
        !messageContent ||
        typeof messageContent !== 'string' ||
        !messageContent.trim()
      ) {
        return;
      }

      const currentPrompt = aiChatMessage.trim();
      setAIChatMessage('');

      // Reset history navigation when sending a message
      setHistoryIndex(-1);
      setCurrentDraft('');

      setAIErrorMessage(null); // Clear any previous errors

      // Track AI chat message submission
      const isRetry = options?.isRetry === 'true';
      const isUndo = options?.isUndo === 'true';
      if (
        !DEBUG &&
        onAIChatMessageSubmitted &&
        aiChatOptions?.vizId
      ) {
        onAIChatMessageSubmitted({
          messageLength: messageContent.trim().length,
          isRetry,
          isUndo,
        });
      }

      // Generate new chat ID only for fresh user messages
      // Keep existing chat ID for retries (Try Harder) and undos
      const isRetryOrUndo = shouldReuseChatId(options);

      let chatIdForRequest: string;
      if (isRetryOrUndo) {
        // Use existing chat ID for retry/undo operations
        chatIdForRequest = activeChatId;
        DEBUG &&
          console.log(
            'Using existing chatId for retry/undo:',
            chatIdForRequest,
          );
      } else {
        // Generate NEW chat ID for fresh user message
        const newChatId = uuidv4();
        setCurrentChatId(newChatId);
        setSelectedChatId(newChatId);
        chatIdForRequest = newChatId;
        DEBUG &&
          console.log(
            'Generated new chatId for fresh message:',
            chatIdForRequest,
          );
      }

      // Call backend endpoint for AI response
      try {
        const response = await fetch(aiChatEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...aiChatOptions,
            content: messageContent.trim(),
            chatId: chatIdForRequest,
            mode: aiChatMode,
            ...options,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}`,
          );
        }

        // Parse the response to check for errors
        const responseData = await response.json();

        // Check if the response contains a VizHub error
        if (
          responseData.outcome === 'failure' &&
          responseData.error
        ) {
          const errorMessage = responseData.error.message;

          // Check if this is the specific permission error that should trigger auto-fork
          if (
            errorMessage ===
            'You do not have permission to use AI chat on this visualization. Only users with edit access can use this feature. Fork the viz to edit it.'
          ) {
            // For authenticated users, trigger auto-fork
            if (autoForkAndRetryAI) {
              try {
                await autoForkAndRetryAI(
                  currentPrompt,
                  aiChatMode,
                );
                // If we reach here, the fork was successful and redirect should happen
                return;
              } catch (forkError) {
                console.error(
                  'Auto-fork failed:',
                  forkError,
                );
                setAIErrorMessage(
                  'Failed to fork visualization. Please try forking manually.',
                );
                return;
              }
            } else {
              // For unauthenticated users, store the message and trigger login flow
              // This will be handled by the external error handler
              setAIErrorMessage(
                errorMessage,
                messageContent.trim(),
              );
              return;
            }
          }

          // For other errors, show the error message
          setAIErrorMessage(
            errorMessage,
            messageContent.trim(),
          );
          return;
        }

        // The backend handles all ShareDB operations for successful responses
        // The loading state is now managed via ShareDB aiStatus
        return responseData;
      } catch (error) {
        console.error('Error getting AI response:', error);
        setAIErrorMessage(
          'Failed to send message. Please try again.',
          messageContent.trim(),
        );
      }
    },
    [
      aiChatMessage,
      aiChatEndpoint,
      aiChatOptions,
      activeChatId,
      aiChatMode,
      autoForkAndRetryAI,
      onAIChatMessageSubmitted,
      DEBUG,
      setAIErrorMessage,
    ],
  );


  return {
    aiChatMessage,
    setAIChatMessage,
    currentChatId,
    selectedChatId,
    setSelectedChatId,
    aiErrorMessage,
    setAIErrorMessage,
    handleSendMessage,
    navigateMessageHistoryUp,
    navigateMessageHistoryDown,
    resetMessageHistoryNavigation,
  };
}
