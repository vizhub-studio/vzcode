import type { ReactNode } from 'react';
import type {
  VizContent,
  VizChatMessage,
} from '@vizhub/viz-types';

/** Chat mode: ask a question, or request an edit. */
export type AIChatMode = 'ask' | 'edit';

/**
 * Sends a chat message. Optionally accepts an explicit message to send
 * (used by suggested prompts) and extra request options.
 */
export type HandleSendMessage = (
  messageToSend?: string,
  options?: Record<string, string>,
) => Promise<unknown>;

/**
 * Host-provided renderer for extra widgets shown on completed AI
 * messages (e.g. VizHub's "open visualization" actions).
 */
export type AdditionalWidgets = (props: {
  messageId: string;
  chatId: string;
  handleSendMessage?: HandleSendMessage;
}) => ReactNode;

/**
 * Optional host-owned control rendered beside Send in the chat composer.
 *
 * The host owns recording, permissions, transcript cleanup, and teardown.
 * VZCode only owns its draft string and submission buttons.
 *
 * Return a React element containing the host component; do not call React
 * hooks directly from this renderer callback.
 */
export type ChatVoiceInputRenderer = (props: {
  /** Current committed chat draft. */
  value: string;
  /** Commit a new full draft (not just the dictated fragment). */
  onChange: (nextValue: string) => void;
  /** Set true during permission, recording, or transcript processing. */
  onBusyChange: (busy: boolean) => void;
  /** Optional transient transcript preview; null clears it. */
  onPreviewChange: (preview: string | null) => void;
}) => ReactNode;

/**
 * Props for the main `AIChat` component.
 *
 * The component is fully controlled: it owns no application state and
 * reads nothing from VZCode context. Wrap it with `AIChatWrapper` to
 * bind these props to a host application's state.
 */
export interface AIChatProps {
  /** ShareDB content, used to read chats and resolve file links. */
  content: VizContent | null;
  /** Whether the chat input should steal focus. */
  aiChatFocused?: boolean;
  aiChatMode: AIChatMode;
  setAIChatMode: (mode: AIChatMode) => void;
  aiChatMessage: string;
  setAIChatMessage: (message: string) => void;
  aiErrorMessage: string | null;
  setAIErrorMessage: (error: string | null) => void;
  /** The chat currently being written to. */
  currentChatId: string;
  /** The chat selected for display (may be null). */
  selectedChatId: string | null;
  setSelectedChatId: (chatId: string | null) => void;
  handleSendMessage: HandleSendMessage;
  navigateMessageHistoryUp: () => void;
  navigateMessageHistoryDown: () => void;
  resetMessageHistoryNavigation: () => void;
  /**
   * Used to restore a prompt after a fork (e.g. VizHub). Returning null
   * means there is nothing to restore.
   */
  getStoredAIPrompt?: () => {
    prompt: string;
    modelName: string;
  } | null;
  /** Called with a file name when a file link in a diff is clicked. */
  onOpenFile?: (fileName: string) => void;
  /** Extra widgets rendered on completed AI messages. */
  additionalWidgets?: AdditionalWidgets;
  /** Show the diff view for file edits. */
  enableDiffView?: boolean;
  /** Show the ask/edit mode toggle in the input. */
  enableAskMode?: boolean;
  /** Show VZCode's legacy voice input button when no host renderer exists. */
  enableVoiceInput?: boolean;
  /** Optional host-owned voice control; takes precedence over enableVoiceInput. */
  renderChatVoiceInput?: ChatVoiceInputRenderer;
  /** Whether the minimal AI edit flow is enabled. */
  enableMinimalEditFlow?: boolean;
}

/** Props for the chat input field. */
export interface ChatInputProps {
  aiChatMessage: string;
  setAIChatMessage: (message: string) => void;
  onSendMessage: () => void;
  focused: boolean;
  aiChatMode: AIChatMode;
  setAIChatMode: (mode: AIChatMode) => void;
  navigateMessageHistoryUp: () => void;
  navigateMessageHistoryDown: () => void;
  resetMessageHistoryNavigation: () => void;
  /** Show the ask/edit mode toggle. */
  enableAskMode?: boolean;
  /** Show VZCode's legacy voice input button when no host renderer exists. */
  enableVoiceInput?: boolean;
  /** Optional host-owned voice control; takes precedence over enableVoiceInput. */
  renderChatVoiceInput?: ChatVoiceInputRenderer;
}

/** Props for the unified diff view. */
export interface DiffViewProps {
  diffData: import('../utils/fileDiff').UnifiedFilesDiff;
  /** Called with a file name when the user clicks it in the diff. */
  onOpenFile?: (fileName: string) => void;
}

/** Props for the scrollable message list. */
export interface MessageListProps {
  messages: VizChatMessage[];
  isLoading: boolean;
  chatId?: string;
  aiScratchpad?: string;
  currentStatus?: string;
  model?: string;
  onNewEvent: (targetElement?: HTMLElement) => void;
  onJumpToLatest: (targetElement?: HTMLElement) => void;
  beforeRender: () => number;
  afterRender: (prevScrollHeight: number) => void;
  additionalWidgets?: AdditionalWidgets;
  handleSendMessage?: HandleSendMessage;
  enableDiffView?: boolean;
  onOpenFile?: (fileName: string) => void;
}

/** Props for a single chat message. */
export interface MessageProps {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  timestamp: number;
  events?: import('../types.js').StreamingEvent[];
  isActive?: boolean;
  chatId?: string;
  showAdditionalWidgets?: boolean;
  isStreaming?: boolean;
  diffData?: import('../utils/fileDiff').UnifiedFilesDiff;
  model?: string;
  additionalWidgets?: AdditionalWidgets;
  handleSendMessage?: HandleSendMessage;
  enableDiffView?: boolean;
  onOpenFile?: (fileName: string) => void;
}
