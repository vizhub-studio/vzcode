import { enableLiveKit } from './featureFlags';
import { VZKeyboardShortcutsDoc } from './VZKeyboardShortcutsDoc';
import { VZSettings } from './VZSettings';
import { VZSidebar } from './VZSidebar';
import { CreateDirModal } from './VZSidebar/CreateDirModal';
import { CreateFileModal } from './VZSidebar/CreateFileModal';
import { VoiceChatModal } from './VZSidebar/VoiceChatModal';

// The middle portion of the VZCode environment, containing:
// * The sidebar
// * The settings modal
// * The create file modal
//
// `enableAIChat` is forwarded to `VZSidebar` so a host can hide the
// "Edit with AI" sidebar button. `undefined` falls back to the
// compile-time feature flag.
export const VZLeft = ({
  enableUsernameField = true,
  enableAIChat,
  aiChatButtonEvent,
}: {
  enableUsernameField?: boolean;
  enableAIChat?: boolean;
  aiChatButtonEvent?: string;
} = {}) => {
  return (
    <div className="left">
      <VZSidebar
        enableAIChat={enableAIChat}
        aiChatButtonEvent={aiChatButtonEvent}
      />
      <VZSettings
        enableUsernameField={enableUsernameField}
      />
      <VZKeyboardShortcutsDoc
        enableUsernameField={enableUsernameField}
      />
      <CreateFileModal />
      <CreateDirModal />
      {enableLiveKit && <VoiceChatModal />}
    </div>
  );
};
