import { useContext, useEffect, useState } from 'react';
import { SplitPaneResizeContext } from './SplitPaneResizeContext';
import { TabList } from './TabList';
import { CodeEditor } from './CodeEditor';
import { ImageViewer } from './ImageViewer';
import { CodeErrorOverlay } from './CodeErrorOverlay';
import { PresenceNotifications } from './PresenceNotifications';
import { AIAssistWidget } from './AIAssist/AIAssistWidget';
import { VZCodeContext } from './VZCodeContext';
import { RunCodeWidget } from './RunCodeWidget';
import { InteractRule } from '@replit/codemirror-interact';
import { EditorView } from '@codemirror/view';
import { Diagnostic } from '@codemirror/lint';
import { isImageFile } from './utils/isImageFile';

// TODO modify this to handle the SplitPane type
// Recursive structure?
// SplitPaneView
// LeafPaneView
const PaneView = ({
  pane,
  content,
  customInteractRules,
  enableAIAssist,
  aiAssistEndpoint,
  aiAssistOptions,
  aiAssistTooltipText,
  aiAssistClickOverride,
  aiCopilotEndpoint,
  esLintSource,
  enableBuiltInAIChat,
}) => {
  // This prevents the CodeEditor from rendering
  // during SSR.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // TODO something like
  // return pane.type === 'leafPane' ? (
  //   <LeafPaneView />
  // ) : (
  //   <SplitPaneView />
  // );

  // This should go in LeafPaneView
  return (
    <>
      <TabList
        activeFileId={pane.activeFileId}
        tabList={pane.tabList}
      />
      {isClient &&
        content &&
        pane.activeFileId &&
        (() => {
          // Get the active file to determine if it's an image
          const activeFile =
            content.files[pane.activeFileId];
          const shouldShowImageViewer =
            activeFile && isImageFile(activeFile.name);

          return shouldShowImageViewer ? (
            <ImageViewer />
          ) : (
            <CodeEditor
              customInteractRules={customInteractRules}
              aiCopilotEndpoint={aiCopilotEndpoint}
              esLintSource={esLintSource}
              enableBuiltInAIChat={enableBuiltInAIChat}
            />
          );
        })()}
      {isClient &&
      enableAIAssist &&
      content &&
      pane.activeFileId ? (
        <AIAssistWidget
          aiAssistEndpoint={aiAssistEndpoint}
          aiAssistOptions={aiAssistOptions}
          aiAssistTooltipText={aiAssistTooltipText}
          aiAssistClickOverride={aiAssistClickOverride}
          paneId={pane.id}
          activeFileId={pane.activeFileId}
          tabList={pane.tabList}
        />
      ) : null}
      <RunCodeWidget />
    </>
  );
};

// The middle portion of the VZCode environment, containing:
// * The list of tabs at the top
// * The code editor itself
// * The code error overlay
// * The presence notifications
// * The UI for AI Assist
export const VZMiddle = ({
  enableAIAssist = false,
  aiAssistEndpoint,
  aiAssistOptions,
  aiAssistTooltipText,
  aiAssistClickOverride,
  aiCopilotEndpoint,
  customInteractRules,
  esLintSource,
  enableAIChat = true,
  aiChatButtonEvent,
}: {
  enableAIAssist?: boolean;
  aiAssistEndpoint?: string;
  aiAssistOptions?: { [key: string]: string };
  aiAssistTooltipText?: string;
  aiAssistClickOverride?: () => void;
  aiCopilotEndpoint?: string;
  customInteractRules?: Array<InteractRule>;
  esLintSource: (
    view: EditorView,
  ) => Promise<readonly Diagnostic[]>;
  enableAIChat?: boolean;
  aiChatButtonEvent?: string;
}) => {
  // The built-in AI chat (including the TODO widget, which prefills a
  // chat message) is only reachable when the feature is enabled and the
  // host hasn't taken over the sidebar button with a custom event.
  const enableBuiltInAIChat =
    enableAIChat && !aiChatButtonEvent;
  const { codeEditorWidth } = useContext(
    SplitPaneResizeContext,
  );

  const {
    content,
    localPresence,
    docPresence,
    pane,
    activePane,
    errorMessage,
  } = useContext(VZCodeContext);

  if (activePane.type !== 'leafPane') {
    throw new Error('Expected leafPane');
  }
  // True if the editor panes should be shown.
  const shouldShowEditorPanes: boolean =
    activePane.activeFileId !== null;

  return shouldShowEditorPanes ? (
    <div
      className="middle"
      style={{ width: codeEditorWidth + 'px' }}
    >
      <PaneView
        pane={pane}
        content={content}
        customInteractRules={customInteractRules}
        enableAIAssist={enableAIAssist}
        aiAssistEndpoint={aiAssistEndpoint}
        aiAssistOptions={aiAssistOptions}
        aiAssistTooltipText={aiAssistTooltipText}
        aiAssistClickOverride={aiAssistClickOverride}
        aiCopilotEndpoint={aiCopilotEndpoint}
        esLintSource={esLintSource}
        enableBuiltInAIChat={enableBuiltInAIChat}
      />
      <CodeErrorOverlay
        errorMessage={errorMessage}
        content={content}
      />
      <PresenceNotifications
        docPresence={docPresence}
        localPresence={localPresence}
      />
    </div>
  ) : null;
};
