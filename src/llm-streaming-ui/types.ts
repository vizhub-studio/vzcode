import type { ReactNode } from 'react';
import type { VizContent } from '@vizhub/viz-types';

/** API owned by the chat UI, not by any particular editor context. */
export type SendChatMessage = (
  messageToSend?: string,
  options?: Record<string, string>,
) => Promise<unknown>;

export type AdditionalChatWidgets = (props: {
  messageId: string;
  chatId: string;
  handleSendMessage?: SendChatMessage;
}) => ReactNode;

export interface AIChatProps {
  content: VizContent | null;
  aiChatFocused: boolean;
  aiChatMode: 'ask' | 'edit';
  aiChatMessage: string;
  currentChatId: string;
  selectedChatId: string | null;
  setSelectedChatId: (chatId: string | null) => void;
  aiErrorMessage: string | null;
  setAIChatMode: (mode: 'ask' | 'edit') => void;
  getStoredAIPrompt?: () => {
    prompt: string;
    modelName: string;
  } | null;
  setAIChatMessage: (message: string) => void;
  handleSendMessage: SendChatMessage;
  setAIErrorMessage: (error: string | null) => void;
  navigateMessageHistoryUp: () => void;
  navigateMessageHistoryDown: () => void;
  resetMessageHistoryNavigation: () => void;
  additionalWidgets?: AdditionalChatWidgets;
  /** Editor-specific navigation stays at the host boundary. */
  onOpenDiffFile?: (fileName: string) => void;
}
