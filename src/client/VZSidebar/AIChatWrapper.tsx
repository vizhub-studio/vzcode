import { useCallback, useContext } from 'react';
import { getFileId } from '@vizhub/viz-utils';
import { VZCodeContext } from '../VZCodeContext';
import { AIChat } from '../../llm-streaming-ui/components/index.js';
import type { AIChatProps } from '../../llm-streaming-ui/types';

/** Adapter: editor context stays outside of the reusable AI chat UI. */
export const AIChatWrapper = () => {
  const {
    content,
    openTab,
    setIsAIChatOpen,
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
    additionalWidgets,
  } = useContext(VZCodeContext);

  const onOpenDiffFile = useCallback(
    (fileName: string) => {
      if (!content) return;
      const fileId = getFileId(content, fileName);
      if (!fileId) return;
      openTab({ fileId, isTransient: false });
      setIsAIChatOpen(false);
    },
    [content, openTab, setIsAIChatOpen],
  );

  const props: AIChatProps = {
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
    additionalWidgets,
    onOpenDiffFile,
  };

  return <AIChat {...props} />;
};
