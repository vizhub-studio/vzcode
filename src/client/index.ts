export type { ThemeLabel, ThemeOption } from './themes';
export type { EditorCache } from './useEditorCache';

export {
  VZCodeProvider,
  VZCodeContext,
} from './VZCodeContext';
export { VZSidebar } from './VZSidebar';
export { VZSettings } from './VZSettings';
export { VZKeyboardShortcutsDoc } from './VZKeyboardShortcutsDoc';
export { VZResizer } from './VZResizer';
export { VZLeft } from './VZLeft';
export { VZMiddle } from './VZMiddle';
export {
  AI_CHAT_BUTTON_EVENT,
  emitAIChatButtonEvent,
  handleAIChatButtonClick,
} from './aiChatButtonEvent';
export type { AIChatButtonEventDetail } from './aiChatButtonEvent';
export {
  SplitPaneResizeProvider,
  SplitPaneResizeContext,
} from './SplitPaneResizeContext';
export { useSubmitOperation } from './useSubmitOperation';
export { shouldTriggerRun } from './shouldTriggerRun';
export { mergeFileChanges } from 'editcodewithai';

export * from './Icons';
