import { useCallback, useContext } from 'react';
import { getFileId } from '@vizhub/viz-utils';
import { AIChat } from '../../llm-streaming-ui';
import { VZCodeContext } from '../VZCodeContext';
import {
  enableAskMode,
  enableDiffView,
  enableVoiceInput,
} from '../featureFlags';

/**
 * Bridges VZCode's context into the standalone `AIChat` component.
 *
 * `AIChat` (from `llm-streaming-ui`) is fully controlled and reads no
 * application state. This wrapper supplies the chat state, callbacks,
 * feature flags, and file-link handling from `VZCodeContext`.
 */
export const AIChatWrapper = () => {
  const {
    content,
    aiChatFocused,
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
    enableMinimalEditFlow,
    additionalWidgets,
    openTab,
    setIsAIChatOpen,
  } = useContext(VZCodeContext);

  // Open a file referenced by a link inside a diff.
  const handleOpenFile = useCallback(
    (fileName: string) => {
      if (!content) return;
      const fileId = getFileId(content, fileName);
      if (fileId) {
        openTab({ fileId, isTransient: false });
        setIsAIChatOpen(false);
      }
    },
    [content, openTab, setIsAIChatOpen],
  );

  return (
    <AIChat
      content={content}
      aiChatFocused={aiChatFocused}
      aiChatMode={aiChatMode}
      setAIChatMode={setAIChatMode}
      aiChatMessage={aiChatMessage}
      setAIChatMessage={setAIChatMessage}
      aiErrorMessage={aiErrorMessage}
      setAIErrorMessage={setAIErrorMessage}
      currentChatId={currentChatId}
      selectedChatId={selectedChatId}
      setSelectedChatId={setSelectedChatId}
      handleSendMessage={handleSendMessage}
      navigateMessageHistoryUp={navigateMessageHistoryUp}
      navigateMessageHistoryDown={
        navigateMessageHistoryDown
      }
      resetMessageHistoryNavigation={
        resetMessageHistoryNavigation
      }
      getStoredAIPrompt={getStoredAIPrompt}
      onOpenFile={handleOpenFile}
      additionalWidgets={additionalWidgets}
      enableDiffView={enableDiffView}
      enableAskMode={enableAskMode}
      enableVoiceInput={enableVoiceInput}
      enableMinimalEditFlow={enableMinimalEditFlow}
    />
  );
};
