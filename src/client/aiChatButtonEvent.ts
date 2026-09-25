/**
 * Host-facing event emitted when the VZCode sidebar "Edit with AI"
 * button is clicked in "emit" mode.
 *
 * A host opts in by passing `aiChatButtonEvent` to `VZSidebar` /
 * `VZLeft`. When set, clicking `#ai-chat-icon` dispatches this event
 * instead of opening VZCode's built-in AI chat panel, so the host can
 * route the click to its own AI editing entry point (e.g. VizHub
 * Studio's top-bar "AI Edit" action).
 *
 * The constant is exported so hosts don't hardcode the event name.
 */
export const AI_CHAT_BUTTON_EVENT =
  'vzcode:ai-chat-button-click';

export interface AIChatButtonEventDetail {
  source: 'vzcode-sidebar';
}

/**
 * Dispatch the host-facing AI chat button event.
 * Kept as a standalone function so it is unit-testable without a DOM.
 */
export function emitAIChatButtonEvent(
  eventName: string,
  target: EventTarget,
): void {
  target.dispatchEvent(
    new CustomEvent<AIChatButtonEventDetail>(eventName, {
      bubbles: true,
      composed: true,
      detail: { source: 'vzcode-sidebar' },
    }),
  );
}

/**
 * Decide what clicking the sidebar AI chat button should do.
 *
 * - When `aiChatButtonEvent` is set, emit the event and leave all
 *   VZCode state untouched (the host owns the action).
 * - Otherwise, fall back to opening VZCode's built-in AI chat.
 *
 * Extracted from the component so the branching is unit-testable
 * without rendering or a real DOM.
 */
export function handleAIChatButtonClick({
  aiChatButtonEvent,
  target,
  openAIChat,
}: {
  aiChatButtonEvent?: string;
  target: EventTarget;
  openAIChat: () => void;
}): void {
  if (aiChatButtonEvent) {
    emitAIChatButtonEvent(aiChatButtonEvent, target);
    return;
  }
  openAIChat();
}
