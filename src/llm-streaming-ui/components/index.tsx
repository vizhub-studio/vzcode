import { useMemo, useEffect, useCallback } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ExtendedVizChat } from '../../types.js';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { JumpToLatestButton } from './JumpToLatestButton';
import type { AIChatProps } from '../props';
import './styles.scss';

const DEBUG = false;

const showSuggestedRequests = false;

const showPreviousChats = false;

// Component for displaying the list of existing chats
const ChatList = ({
  chats,
  selectedChatId,
  onSelectChat,
  getChatTitle,
}) => {
  return (
    <div className="ai-chat-list">
      <div className="ai-chat-list-header">
        <h4>Previous Chats</h4>
      </div>
      <div className="ai-chat-suggested-prompts">
        {chats.map((chat) => (
          <button
            key={chat.id}
            className={`ai-chat-suggested-prompt ${
              selectedChatId === chat.id ? 'selected' : ''
            }`}
            onClick={() => onSelectChat(chat.id)}
          >
            {getChatTitle(chat)}
          </button>
        ))}
      </div>
    </div>
  );
};

export const AIChat = ({
  aiChatFocused,
  content,
  aiChatMode,
  aiChatMessage,
  currentChatId,
  selectedChatId,
  setSelectedChatId,
  aiErrorMessage,
  setAIChatMode,
  getStoredAIPrompt,
  setAIChatMessage,
  handleSendMessage,
  setAIErrorMessage,
  navigateMessageHistoryUp,
  navigateMessageHistoryDown,
  resetMessageHistoryNavigation,
  enableMinimalEditFlow = false,
  additionalWidgets,
  enableDiffView = true,
  enableAskMode = false,
  enableVoiceInput = false,
  onOpenFile,
}: AIChatProps) => {
  // Use the new simplified auto-scroll hook
  const {
    containerRef: messagesContainerRef,
    showJumpButton,
    onNewEvent,
    onJumpToLatest,
    beforeRender,
    afterRender,
  } = useAutoScroll({ threshold: 24 });

  // Get the active chat ID and chat data
  // If selectedChatId is set, use it; otherwise, if no chat selected, don't default to currentChatId
  const activeChatId = selectedChatId;
  const currentChat = activeChatId
    ? content?.chats?.[activeChatId]
    : null;
  const rawMessages = useMemo(
    () => currentChat?.messages || [],
    [currentChat?.messages],
  );
  const aiStatus = currentChat?.aiStatus;
  const aiScratchpad = currentChat?.aiScratchpad;
  const currentStatus = (currentChat as ExtendedVizChat)
    ?.currentStatus;
  const model = (currentChat as ExtendedVizChat)?.model;

  DEBUG && console.log('AIChat: aiStatus:', aiStatus);
  DEBUG &&
    console.log(
      'AIChat: enableMinimalEditFlow:',
      enableMinimalEditFlow,
    );

  // Transform messages to ensure they have required id field - memoized to avoid recreation
  const messages = useMemo(
    () =>
      rawMessages.map((msg, index) => ({
        ...msg,
        id: msg.id || `msg-${index}`,
      })),
    [rawMessages],
  );

  // Check if this is the first time opening the chat (no messages) or no chat selected
  const isEmptyState =
    !selectedChatId || rawMessages.length === 0;

  // Get all existing chats
  const allChats = content?.chats || {};
  const existingChats = Object.values(allChats).filter(
    (chat) => chat.messages.length > 0,
  );
  const hasExistingChats = existingChats.length > 0;

  // Generate title for a chat (first 50 characters of first user message)
  const getChatTitle = (chat) => {
    const firstUserMessage = chat.messages.find(
      (msg) => msg.role === 'user',
    );
    if (!firstUserMessage) return 'New Chat';
    return (
      firstUserMessage.content.slice(0, 50) +
      (firstUserMessage.content.length > 50 ? '...' : '')
    );
  };

  // Wrapper for handleSendMessage to automatically select the chat when sending
  const handleSendMessageWithSelection = useCallback(() => {
    // If no chat is selected, select the currentChatId when sending a message
    if (!selectedChatId) {
      setSelectedChatId(currentChatId);
    }

    // Call the original handleSendMessage without parameters
    return handleSendMessage();
  }, [
    selectedChatId,
    setSelectedChatId,
    currentChatId,
    handleSendMessage,
  ]);

  // Check for stored AI prompt on component mount (post-fork restoration)
  // This logic is now handled by the AutoSendAIMessage component in VizHub
  // to ensure proper timing and coordination with editor opening
  useEffect(() => {
    DEBUG &&
      console.log('AIChat: Checking for stored AI prompt');
    if (getStoredAIPrompt) {
      const storedPrompt = getStoredAIPrompt();
      DEBUG &&
        console.log(
          'AIChat: Stored prompt result:',
          storedPrompt,
        );
      if (storedPrompt) {
        // Only restore the prompt and mode, but don't auto-send
        // The AutoSendAIMessage component will handle the sending
        DEBUG &&
          console.log(
            'AIChat: Restoring prompt and mode only',
          );
        setAIChatMessage(storedPrompt.prompt);
        setAIChatMode(
          storedPrompt.modelName === 'ask' ? 'ask' : 'edit',
        );

        // Don't clear the stored prompt here - let AutoSendAIMessage handle it
        // Don't auto-submit here - let AutoSendAIMessage handle the timing
        DEBUG &&
          console.log(
            'AIChat: Prompt restored, waiting for AutoSendAIMessage to handle sending',
          );
      } else {
        DEBUG &&
          console.log('AIChat: No stored prompt found');
      }
    }
  }, [getStoredAIPrompt, setAIChatMessage, setAIChatMode]);

  return (
    <div className="ai-chat-container">
      <div className="ai-chat-content">
        <div
          className="ai-chat-messages-container"
          ref={messagesContainerRef}
        >
          {isEmptyState ? (
            <div className="ai-chat-empty">
              <div className="ai-chat-empty-icon">✨</div>
              <h3 className="ai-chat-empty-title">
                Edit with AI
              </h3>
              <div className="ai-chat-empty-text">
                How can I help you?
              </div>
              {hasExistingChats && showPreviousChats && (
                <ChatList
                  chats={existingChats}
                  selectedChatId={selectedChatId}
                  onSelectChat={setSelectedChatId}
                  getChatTitle={getChatTitle}
                />
              )}
              {showSuggestedRequests && (
                <div className="ai-chat-empty-examples">
                  {aiChatMode === 'ask' ? (
                    <>
                      <h4>Try asking questions like:</h4>
                      <div className="ai-chat-suggested-prompts">
                        <button
                          className="ai-chat-suggested-prompt"
                          onClick={() =>
                            handleSendMessage(
                              'Explain how this works',
                            )
                          }
                        >
                          &quot;Explain how this works&quot;
                        </button>
                        <button
                          className="ai-chat-suggested-prompt"
                          onClick={() =>
                            handleSendMessage(
                              'How could I change it so that the circles are bigger?',
                            )
                          }
                        >
                          &quot;How could I change it so
                          that the circles are bigger?&quot;
                        </button>
                        <button
                          className="ai-chat-suggested-prompt"
                          onClick={() =>
                            handleSendMessage(
                              'What does this function do?',
                            )
                          }
                        >
                          &quot;What does this function
                          do?&quot;
                        </button>
                        <button
                          className="ai-chat-suggested-prompt"
                          onClick={() =>
                            handleSendMessage(
                              'How can I make this more accessible?',
                            )
                          }
                        >
                          &quot;How can I make this more
                          accessible?&quot;
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4>Try edit requests like these:</h4>
                      <div className="ai-chat-suggested-prompts">
                        <button
                          className="ai-chat-suggested-prompt"
                          onClick={() =>
                            handleSendMessage(
                              'Change the circles to squares',
                            )
                          }
                        >
                          &quot;Change the circles to
                          squares&quot;
                        </button>
                        <button
                          className="ai-chat-suggested-prompt"
                          onClick={() =>
                            handleSendMessage(
                              'Add a button that toggles the animation',
                            )
                          }
                        >
                          &quot;Add a button that toggles
                          the animation&quot;
                        </button>
                        <button
                          className="ai-chat-suggested-prompt"
                          onClick={() =>
                            handleSendMessage(
                              'Fix the CSS so the layout is responsive',
                            )
                          }
                        >
                          &quot;Fix the CSS so the layout is
                          responsive&quot;
                        </button>
                        <button
                          className="ai-chat-suggested-prompt"
                          onClick={() =>
                            handleSendMessage(
                              'Refactor this function to use async/await',
                            )
                          }
                        >
                          &quot;Refactor this function to
                          use async/await&quot;
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {showSuggestedRequests && (
                <div className="ai-chat-empty-text">
                  {aiChatMode === 'ask'
                    ? 'Type your question below to get started!'
                    : 'Type your edit request below to get started!'}
                </div>
              )}
            </div>
          ) : (
            <MessageList
              messages={messages}
              isLoading={false}
              chatId={selectedChatId || currentChatId}
              aiScratchpad={aiScratchpad}
              currentStatus={currentStatus}
              model={model}
              onNewEvent={onNewEvent}
              onJumpToLatest={onJumpToLatest}
              beforeRender={beforeRender}
              afterRender={afterRender}
              additionalWidgets={additionalWidgets}
              handleSendMessage={handleSendMessage}
              enableDiffView={enableDiffView}
              onOpenFile={onOpenFile}
            />
          )}
          {aiErrorMessage && (
            <div className="ai-chat-error">
              <div className="ai-chat-error-content">
                <span className="ai-chat-error-icon">
                  ⚠️
                </span>
                <span className="ai-chat-error-message">
                  {aiErrorMessage}
                </span>
                <button
                  className="ai-chat-error-dismiss"
                  onClick={() => setAIErrorMessage(null)}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          {/* Jump to Latest Button */}
          <JumpToLatestButton
            visible={showJumpButton}
            onClick={onJumpToLatest}
          />
        </div>
      </div>
      <div className="ai-chat-input-fixed">
        <ChatInput
          aiChatMessage={aiChatMessage}
          setAIChatMessage={setAIChatMessage}
          onSendMessage={handleSendMessageWithSelection}
          focused={aiChatFocused ?? false}
          aiChatMode={aiChatMode}
          setAIChatMode={setAIChatMode}
          enableAskMode={enableAskMode}
          enableVoiceInput={enableVoiceInput}
          navigateMessageHistoryUp={
            navigateMessageHistoryUp
          }
          navigateMessageHistoryDown={
            navigateMessageHistoryDown
          }
          resetMessageHistoryNavigation={
            resetMessageHistoryNavigation
          }
        />
      </div>
    </div>
  );
};
