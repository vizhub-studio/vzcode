import {
  useRef,
  useEffect,
  useCallback,
  memo,
} from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { MicSVG, MicOffSVG } from './icons';
import type { ChatInputProps } from '../props';

/**
 * Microphone toggle for voice typing. Purely presentational: the
 * speech recognition state lives in `ChatInputComponent`, and is only
 * ever instantiated when the user actually toggles the button.
 *
 * Rendered only when `enableVoiceInput` is set. See `props`.
 */
const VoiceInputButton = ({
  isSpeaking,
  onToggle,
}: {
  isSpeaking: boolean;
  onToggle: () => void;
}) => {
  const label = isSpeaking
    ? 'Stop voice typing'
    : 'Start voice typing';

  return (
    <button type="button" className={`vz-chat-button ${isSpeaking ? 'vz-chat-button--danger' : 'vz-chat-button--outline-secondary'}`}
      onClick={onToggle}
      aria-label={label}
      title={label}
      style={{
        borderColor: isSpeaking ? undefined : '#94a3b8',
        borderRadius: '0.375rem',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {isSpeaking ? <MicOffSVG /> : <MicSVG />}
    </button>
  );
};

const ChatInputComponent = ({
  aiChatMessage,
  setAIChatMessage,
  onSendMessage,
  focused,
  aiChatMode,
  setAIChatMode,
  navigateMessageHistoryUp,
  navigateMessageHistoryDown,
  resetMessageHistoryNavigation,
  enableAskMode = false,
  enableVoiceInput = false,
}: ChatInputProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Speech recognition is created lazily on first toggle, so simply
  // mounting this hook does not touch any browser media APIs.
  const {
    isSpeaking,
    toggleSpeechRecognition,
    stopSpeaking,
  } = useSpeechRecognition(setAIChatMessage);

  useEffect(() => {
    // Focus the input when the AI chat is focused
    if (focused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focused]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSendMessage();
      } else if (event.key === 'Enter' && event.shiftKey) {
        // Shift+Enter should add a newline, not trigger run code
        // We prevent the event from bubbling up to the global keyboard handler
        event.stopPropagation();
      } else if (event.key === 'ArrowUp') {
        // Only navigate history if cursor is at the beginning of the first line
        const textarea =
          event.target as HTMLTextAreaElement;
        const { selectionStart, value } = textarea;
        const lines = value
          .substring(0, selectionStart)
          .split('\n');

        // Check if we're at the beginning of the first line
        if (lines.length === 1 && selectionStart === 0) {
          event.preventDefault();
          navigateMessageHistoryUp();
        }
      } else if (event.key === 'ArrowDown') {
        // Only navigate history if cursor is at the end of the last line
        const textarea =
          event.target as HTMLTextAreaElement;
        const { selectionStart, value } = textarea;
        const remainingText =
          value.substring(selectionStart);
        const remainingLines = remainingText.split('\n');

        // Check if we're at the end of the last line
        if (
          remainingLines.length === 1 &&
          remainingLines[0] === ''
        ) {
          event.preventDefault();
          navigateMessageHistoryDown();
        }
      }
    },
    [
      onSendMessage,
      navigateMessageHistoryUp,
      navigateMessageHistoryDown,
    ],
  );

  const handleSendClick = useCallback(() => {
    // If speech recognition is active, stop it
    if (isSpeaking) {
      stopSpeaking();
    }
    onSendMessage();
  }, [onSendMessage, isSpeaking, stopSpeaking]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setAIChatMessage(event.target.value);
      // Reset history navigation when user starts typing
      resetMessageHistoryNavigation();
    },
    [setAIChatMessage, resetMessageHistoryNavigation],
  );

  return (
    <div className="ai-chat-input-container">
      {enableAskMode && (
        <div
          className="ai-chat-mode-toggle"
          style={{ marginBottom: '8px' }}
        >
          <div className="vz-chat-button-group">
            <button type="button" id="ai-chat-mode-ask" className={`vz-chat-button ${aiChatMode === 'ask' ? 'vz-chat-button--primary' : 'vz-chat-button--outline-primary'}`} aria-pressed={aiChatMode === 'ask'} onClick={() => setAIChatMode('ask')}>💬 Ask</button>
            <button type="button" id="ai-chat-mode-edit" className={`vz-chat-button ${aiChatMode === 'edit' ? 'vz-chat-button--primary' : 'vz-chat-button--outline-primary'}`} aria-pressed={aiChatMode === 'edit'} onClick={() => setAIChatMode('edit')}>✏️ Edit</button>
          </div>
          <div className="ai-chat-mode-description">
            {aiChatMode === 'ask'
              ? 'Ask questions without editing files'
              : 'Get answers and code edits'}
          </div>
        </div>
      )}
      <div className="ai-chat-input-group">
        <textarea
          rows={10}
          value={aiChatMessage}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          ref={inputRef}
          placeholder={
            aiChatMode === 'edit'
              ? 'Ask me to make code changes...'
              : 'Ask me anything about your code...'
          }
          spellCheck="false"
          aria-label="Chat message input"
        />
        <div className="ai-chat-input-footer">
          <span className="ai-chat-hint">
            {aiChatMessage ? 'Press Enter to send' : ''}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {enableVoiceInput && (
              <VoiceInputButton
                isSpeaking={isSpeaking}
                onToggle={toggleSpeechRecognition}
              />
            )}
            <button type="button"
              onClick={handleSendClick}
              disabled={!aiChatMessage.trim()}
              className={`ai-chat-send-button vz-chat-button ${aiChatMessage.trim() ? "vz-chat-button--primary" : "vz-chat-button--outline-secondary"}`}
              aria-label="Send message"
              title="Send message (Enter)"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChatInput = memo(ChatInputComponent);
