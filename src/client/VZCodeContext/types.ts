import {
  ItemId,
  LeafPane,
  Pane,
  PaneId,
  PresenceIndicator,
  SearchFileVisibility,
  SearchResults,
  ShareDBDoc,
  SubmitOperation,
  TabState,
  Username,
} from '../../types';
import { VizFiles, VizContent } from '@vizhub/viz-types';
import { ThemeLabel } from '../themes';
import { EditorCache } from '../useEditorCache';

// The type of the object provided by this context.
export type VZCodeContextValue = {
  content: VizContent | null;
  shareDBDoc: ShareDBDoc<VizContent> | null;
  submitOperation: (
    next: (content: VizContent) => VizContent,
  ) => void;
  // TODO pull in this type from ShareDB if possible
  localPresence: any;
  // TODO pull in this type from ShareDB if possible
  docPresence: any;

  files: VizFiles | null;
  createFile: (fileName: string, text?: string) => void;
  renameFile: (fileId: string, fileName: string) => void;
  deleteFile: (fileId: string) => void;
  createDirectory: (
    fileName: string,
    text?: string,
  ) => void;
  renameDirectory: (
    directoryId: string,
    directoryOldName: string,
    directoryName: string,
  ) => void;
  deleteDirectory: (directoryId: string) => void;
  deleteAllFiles: () => void;

  setActiveFileId: (fileId: string | null) => void;
  setActiveFileLeft: () => void;
  setActiveFileRight: () => void;

  activePaneId: PaneId;
  pane: Pane;
  activePane: LeafPane;

  openTab: (tabState: TabState) => void;
  closeTabs: (fileIds: string[]) => void;

  isSettingsOpen: boolean;
  setIsSettingsOpen: (isSettingsOpen: boolean) => void;
  closeSettings: () => void;

  isDocOpen: boolean;
  setIsDocOpen: (isDocOpen: boolean) => void;
  closeDoc: () => void;

  theme: ThemeLabel;
  setTheme: (theme: ThemeLabel) => void;

  username: Username;
  setUsername: (username: Username) => void;

  isDirectoryOpen: (path: string) => boolean;
  toggleDirectory: (path: string) => void;

  editorCache: EditorCache;

  // Whether the editor should be focused.
  editorWantsFocus: boolean;
  // Signals that the editor no longer wants focus.
  editorNoLongerWantsFocus: () => void;

  errorMessage: string | null;

  // Runtime error handling
  handleRuntimeError: (
    formattedErrorMessage: string,
  ) => void;
  clearRuntimeError: () => void;

  search: SearchResults;
  isSearchOpen: boolean;
  setIsSearchOpen: (isSearchOpen: boolean) => void;
  setSearch: (pattern: string) => void;

  isVisualEditorOpen: boolean;
  setIsVisualEditorOpen: (
    isVisualEditorOpen: boolean,
  ) => void;

  isAIChatOpen: boolean;
  setIsAIChatOpen: (isAIChatOpen: boolean) => void;
  aiChatFocused: boolean;
  toggleAIChatFocused: () => void;
  aiChatMode: 'ask' | 'edit';
  setAIChatMode: (mode: 'ask' | 'edit') => void;
  aiChatEndpoint?: string;
  aiChatOptions?: { [key: string]: any };
  setSearchResults: (files: ShareDBDoc<VizContent>) => void;
  setSearchFileVisibility: (
    files: ShareDBDoc<VizContent>,
    id: string,
    visibility: SearchFileVisibility,
  ) => void;
  setSearchLineVisibility: (
    files: ShareDBDoc<VizContent>,
    id: string,
    line: number,
  ) => void;
  setSearchFocusedIndex: (
    focusedIndex: number,
    childIndex: number,
  ) => void;
  toggleSearchFocused: () => void;

  isCreateFileModalOpen: boolean;
  handleOpenCreateFileModal: () => void;
  handleCloseCreateFileModal: () => void;
  handleCreateFileClick: (newFileName: string) => void;

  isCreateDirModalOpen: boolean;
  handleOpenCreateDirModal: () => void;
  handleCloseCreateDirModal: () => void;
  handleCreateDirClick: (newFileName: string) => void;

  runPrettierRef: React.MutableRefObject<
    null | (() => void)
  >;
  runCodeRef: React.MutableRefObject<
    null | ((hardRerun?: boolean) => void)
  >;

  sidebarRef: React.RefObject<HTMLDivElement>;

  codeEditorRef: React.RefObject<HTMLDivElement>;

  iframeRef: React.MutableRefObject<HTMLIFrameElement>;

  connected: boolean;
  pending: boolean;

  hoveredItemId: ItemId | null;
  setHoveredItemId: (itemId: ItemId | null) => void;

  enableAutoFollow: boolean;
  toggleAutoFollow: () => void;

  updatePresenceIndicator: (
    presenceIndicator: PresenceIndicator,
  ) => void;

  sidebarPresenceIndicators: Array<PresenceIndicator>;
  splitCurrentPane: () => void;

  liveKitToken: string;
  setLiveKitToken: (state: string) => void;
  liveKitRoomName: string;
  setLiveKitRoom: (state: string) => void;
  liveKitConnection: boolean;
  setLiveKitConnection: (state: boolean) => void;
  voiceChatModalOpen: boolean;
  setVoiceChatModalOpen: (state: boolean) => void;
  aiChatMessage: string;
  setAIChatMessage: (message: string) => void;
  currentChatId: string;
  selectedChatId: string | null;
  setSelectedChatId: (chatId: string | null) => void;
  aiErrorMessage: string | null;
  setAIErrorMessage: (state: string | null) => void;
  handleSendMessage: (
    messageToSend?: string,
    options?: Record<string, string>,
  ) => Promise<any>;

  // Message history navigation
  navigateMessageHistoryUp: () => void;
  navigateMessageHistoryDown: () => void;
  resetMessageHistoryNavigation: () => void;

  // Auto-fork functions for VizHub integration
  autoForkAndRetryAI?: (
    prompt: string,
    modelName: string,
    commitId?: string,
  ) => Promise<void>;
  clearStoredAIPrompt?: () => void;
  getStoredAIPrompt?: () => {
    prompt: string;
    modelName: string;
  } | null;

  // Additional widgets that can be rendered in AI chat messages
  additionalWidgets?: (props: {
    messageId: string;
    chatId: string;
    handleSendMessage?: (
      messageToSend?: string,
      options?: Record<string, string>,
    ) => Promise<any>;
  }) => React.ReactNode;

  // Feature flags
  enableMinimalEditFlow: boolean;

  // Analytics callback for chat message submissions
  onAIChatMessageSubmitted?: (params: {
    messageLength: number;
    isRetry?: boolean;
    isUndo?: boolean;
  }) => void;
};

export interface VZCodeProviderProps {
  content: VizContent;
  shareDBDoc: ShareDBDoc<VizContent>;
  submitOperation: SubmitOperation;
  localPresence: any;
  docPresence: any;
  prettierWorker: Worker;
  initialUsername: Username;
  children: React.ReactNode;
  codeError?: string | null;
  connected?: boolean;
  pending?: boolean;
  liveKitToken?: string | undefined;
  setLiveKitToken?: (state: string) => void;
  liveKitRoomName?: string | undefined;
  setLiveKitRoom?: (state: string) => void;
  liveKitConnection?: boolean;
  setLiveKitConnection?: (state: boolean) => void;
  aiChatEndpoint?: string;
  aiChatOptions?: { [key: string]: any };
  autoForkAndRetryAI?: (
    prompt: string,
    modelName: string,
    commitId?: string,
  ) => Promise<void>;
  clearStoredAIPrompt?: () => void;
  getStoredAIPrompt?: () => {
    prompt: string;
    modelName: string;
  } | null;
  additionalWidgets?: (props: {
    messageId: string;
    chatId: string;
    handleSendMessage?: (
      messageToSend?: string,
      options?: Record<string, string>,
    ) => Promise<any>;
  }) => React.ReactNode;
  iframeRef?: React.MutableRefObject<HTMLIFrameElement>;
  handleChatError?: (
    error: string,
    message?: string,
  ) => void;
  onAIChatMessageSubmitted?: (params: {
    messageLength: number;
    isRetry?: boolean;
    isUndo?: boolean;
  }) => void;
}
