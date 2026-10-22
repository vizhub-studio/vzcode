/**
 * @vizhub/llm-streaming-ui
 *
 * Client-side React UI components for displaying streaming AI edits and chat.
 * This module provides functionality for:
 * - Displaying AI chat messages with streaming support
 * - Showing real-time diffs and code changes
 * - Rendering thinking/reasoning scratchpads
 * - Managing file editing indicators
 * - Voice input support
 */

// Main AI Chat component
export { AIChat } from './components/index.js';

// Message display components
export { MessageList } from './components/MessageList.js';
export { Message } from './components/Message.js';

// Diff visualization components
export { DiffView } from './components/DiffView.js';
export { IndividualFileDiff } from './components/IndividualFileDiff.js';

// Status and indicator components
export { TypingIndicator } from './components/TypingIndicator.js';
export { ThinkingScratchpad } from './components/ThinkingScratchpad.js';
export { AIEditingStatusIndicator as FileEditingIndicator } from './components/FileEditingIndicator';
export { JumpToLatestButton } from './components/JumpToLatestButton.js';

// Input components
export { ChatInput } from './components/ChatInput.js';

// Custom hooks
export { useSpeechRecognition } from './components/useSpeechRecognition.js';
export { useAutoScroll } from './hooks/useAutoScroll.js';

// Public prop types
export type {
  AIChatProps,
  AIChatMode,
  AdditionalWidgets,
  ChatInputProps,
  DiffViewProps,
  HandleSendMessage,
  MessageListProps,
  MessageProps,
} from './props.js';
