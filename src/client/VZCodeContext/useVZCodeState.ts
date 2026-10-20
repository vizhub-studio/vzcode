import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { defaultTheme, useDynamicTheme } from '../themes';
import { useActions } from '../useActions';
import { useEditorCache } from '../useEditorCache';
import { useFileCRUD } from '../useFileCRUD';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { useOpenDirectories } from '../useOpenDirectories';
import { usePrettier } from '../usePrettier';
import { useRunCode } from '../useRunCode';
import { useRuntimeError } from '../useRuntimeError';
import { useURLSync } from '../useURLSync';
import {
  createInitialState,
  vzReducer,
} from '../vzReducer';
import { findPane } from '../vzReducer/findPane';
import { usePresenceAutoFollow } from '../usePresenceAutoFollow';
import { useAIChatSession } from './useAIChatSession';
import {
  VZCodeContextValue,
  VZCodeProviderProps,
} from './types';
import { enableMinimalEditFlow } from '../featureFlags';

export const useVZCodeState = ({
  content,
  shareDBDoc,
  submitOperation,
  localPresence,
  docPresence,
  prettierWorker,
  initialUsername,
  initialSidebarView,
  renderVisualEditorEmptyState,
  codeError = null,
  connected,
  pending,
  liveKitToken,
  setLiveKitToken,
  liveKitRoomName,
  setLiveKitRoom,
  liveKitConnection,
  setLiveKitConnection,
  aiChatEndpoint,
  aiChatOptions,
  autoForkAndRetryAI,
  clearStoredAIPrompt,
  getStoredAIPrompt,
  additionalWidgets,
  iframeRef: externalIframeRef,
  handleChatError,
  onAIChatMessageSubmitted,
}: Omit<
  VZCodeProviderProps,
  'children'
>): VZCodeContextValue => {
  // Auto-run Prettier after local changes.
  const { prettierError, runPrettierRef } = usePrettier({
    shareDBDoc,
    submitOperation,
    prettierWorker,
  });

  // Handle runtime errors from the iframe
  const {
    runtimeError,
    handleRuntimeError,
    clearRuntimeError,
  } = useRuntimeError();

  const runCodeRef = useRunCode(submitOperation);

  const sidebarRef = useRef(null);

  const codeEditorRef = useRef(null);
  const internalIframeRef = useRef(null);

  // Use external iframeRef if provided, otherwise use internal one
  const iframeRef = externalIframeRef || internalIframeRef;

  // The error message shows errors in order of priority:
  // * `runtimeError` - errors from runtime execution, highest priority
  // * `prettierError` - errors from Prettier, client-side only
  // * `codeError` - errors from an external source, such as
  //   build-time errors or intercepted runtime errors.
  // Runtime errors are prioritized since they indicate immediate execution issues.
  // Prettier errors are next since they surface syntax errors that are likely
  // to be useful to the user.
  const errorMessage: string | null = runtimeError
    ? runtimeError
    : prettierError
      ? prettierError
      : codeError;

  // Set up the reducer that manages much of the application state.
  // See https://react.dev/reference/react/useReducer
  const [state, dispatch] = useReducer(
    vzReducer,
    { defaultTheme, initialUsername, initialSidebarView },
    createInitialState,
  );

  // Unpack state.
  const {
    pane,
    activePaneId,
    theme,
    search,
    isSearchOpen,
    isVisualEditorOpen,
    isAIChatOpen,
    aiChatFocused,
    isSettingsOpen,
    isDocOpen,
    editorWantsFocus,
    username,
    enableAutoFollow,
    sidebarPresenceIndicators,
    aiChatMode,
  } = state;

  const activePane = findPane(pane, activePaneId);
  if (activePane.type !== 'leafPane') {
    // Should never happen
    throw new Error('Expected leafPane');
  }

  // Functions for dispatching actions to the reducer.
  const {
    setActiveFileId,
    setActiveFileLeft,
    setActiveFileRight,
    openTab,
    closeTabs,
    setTheme,
    setIsSearchOpen,
    setSearch,
    setSearchResults,
    setSearchFileVisibility,
    setSearchLineVisibility,
    setSearchFocusedIndex,
    toggleSearchFocused,
    setIsVisualEditorOpen,
    setIsAIChatOpen,
    toggleAIChatFocused,
    setAIChatMode,
    setIsSettingsOpen,
    setIsDocOpen,
    closeSettings,
    closeDoc,
    editorNoLongerWantsFocus,
    setUsername,
    toggleAutoFollow,
    updatePresenceIndicator,
    splitCurrentPane,
  } = useActions(dispatch);

  // Sync tab state to the URL.
  useURLSync({
    content,
    openTab,
    setActiveFileId,
    tabList: activePane.tabList,
    activeFileId: activePane.activeFileId,
  });

  // The set of open directories.
  const { isDirectoryOpen, toggleDirectory } =
    useOpenDirectories({ activePane, content });

  // Cache of CodeMirror editors by file id.
  const editorCache = useEditorCache();

  // Handle dynamic theme changes.
  useDynamicTheme(editorCache, theme);

  // Handle file CRUD operations (Create, Read, Update, Delete)
  const {
    createFile,
    renameFile,
    deleteFile,
    createDirectory,
    renameDirectory,
    deleteDirectory,
    deleteAllFiles,
  } = useFileCRUD({
    submitOperation,
    closeTabs,
    openTab,
    editorCache,
    content,
  });

  // State to control the create file modal's visibility
  const [isCreateFileModalOpen, setIsCreateFileModalOpen] =
    useState(false);

  const handleOpenCreateFileModal = useCallback(() => {
    setIsCreateFileModalOpen(true);
  }, []);

  const handleCloseCreateFileModal = useCallback(() => {
    setIsCreateFileModalOpen(false);
  }, []);

  const handleCreateFileClick = useCallback(
    (newFileName: string) => {
      createFile(newFileName);
      setIsCreateFileModalOpen(false);
    },
    [createFile, setIsCreateFileModalOpen],
  );

  // State to control the create directory modal's visibility
  const [isCreateDirModalOpen, setIsCreateDirModalOpen] =
    useState(false);

  const handleOpenCreateDirModal = useCallback(() => {
    setIsCreateDirModalOpen(true);
  }, []);

  const handleCloseCreateDirModal = useCallback(() => {
    setIsCreateDirModalOpen(false);
  }, []);

  const handleCreateDirClick = useCallback(
    (newDirName: string) => {
      createDirectory(newDirName);
      setIsCreateDirModalOpen(false);
    },
    [createDirectory, setIsCreateDirModalOpen],
  );

  // Isolate the files object from the document.
  const files = content ? content.files : null;

  useKeyboardShortcuts({
    closeTabs,
    activeFileId: activePane.activeFileId,
    activePaneId,
    handleOpenCreateFileModal,
    setActiveFileLeft,
    setActiveFileRight,
    toggleSearchFocused,
    runPrettierRef,
    runCodeRef,
    sidebarRef,
    editorCache,
    codeEditorRef,
  });

  // Track the currently hovered file id.
  const [hoveredItemId, setHoveredItemId] = useState(null);

  // Handle presence-based auto-following
  usePresenceAutoFollow({
    docPresence,
    enableAutoFollow,
    openTab,
    activePane,
  });

  // Livekit Voice Chat Modal
  const [voiceChatModalOpen, setVoiceChatModalOpen] =
    useState(false);

  const {
    aiChatMessage,
    setAIChatMessage,
    currentChatId,
    selectedChatId,
    setSelectedChatId,
    aiErrorMessage,
    setAIErrorMessage,
    handleSendMessage,
    navigateMessageHistoryUp,
    navigateMessageHistoryDown,
    resetMessageHistoryNavigation,
  } = useAIChatSession({
    content,
    submitOperation,
    aiChatMode,
    aiChatEndpoint,
    aiChatOptions,
    autoForkAndRetryAI,
    handleChatError,
    onAIChatMessageSubmitted,
  });

  // Config.json change detection and iframe notification
  // This logic was moved from VisualEditor.tsx to ensure it runs
  // even when the visual editor is not open, fixing cross-client propagation
  const previousConfigRef = useRef<any>(null);
  const CONFIG_FILE_NAME = 'config.json';

  useEffect(() => {
    // Find config.json file
    let configFileId = null;
    for (const fileId in files) {
      if (files[fileId].name === CONFIG_FILE_NAME) {
        configFileId = fileId;
        break;
      }
    }

    if (!configFileId || !files || !files[configFileId]) {
      return;
    }

    let newConfigData;
    try {
      newConfigData = JSON.parse(files[configFileId].text);
    } catch {
      // If config is invalid JSON, we can't process changes
      return;
    }

    const previousConfig = previousConfigRef.current;

    // Update the ref with the new config
    previousConfigRef.current = newConfigData;

    // Skip processing if this is the first time or if there's no previous config
    if (!previousConfig) {
      return;
    }

    // Find changed top-level properties
    const changedProperties: { [key: string]: any } = {};

    // Check all properties in the new config
    for (const key in newConfigData) {
      if (newConfigData[key] !== previousConfig[key]) {
        // Deep comparison for objects to detect actual changes
        if (
          typeof newConfigData[key] === 'object' &&
          typeof previousConfig[key] === 'object'
        ) {
          if (
            JSON.stringify(newConfigData[key]) !==
            JSON.stringify(previousConfig[key])
          ) {
            changedProperties[key] = newConfigData[key];
          }
        } else {
          changedProperties[key] = newConfigData[key];
        }
      }
    }

    // Check for deleted properties (properties that existed before but don't exist now)
    for (const key in previousConfig) {
      if (!(key in newConfigData)) {
        changedProperties[key] = undefined;
      }
    }

    // Send changed properties to iframe if any changes were detected
    if (Object.keys(changedProperties).length > 0) {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          changedProperties,
        );
      } catch (_error_) {
        console.error(
          'Failed to send config changes to iframe:',
          _error_,
        );
      }
    }
  }, [files, iframeRef]);

  // Return the context value
  return {
    content,
    shareDBDoc,
    submitOperation,
    localPresence,
    docPresence,

    files,
    createFile,
    renameFile,
    deleteFile,
    createDirectory,
    renameDirectory,
    deleteDirectory,
    deleteAllFiles,

    setActiveFileId,
    setActiveFileLeft,
    setActiveFileRight,

    activePaneId,
    // Root pane
    pane,
    // Active leaf pane
    activePane,

    openTab,
    closeTabs,

    search,
    isSearchOpen,
    setIsSearchOpen,
    setSearch,
    setSearchResults,
    setSearchFileVisibility,
    setSearchLineVisibility,
    setSearchFocusedIndex,
    toggleSearchFocused,

    renderVisualEditorEmptyState,
    isVisualEditorOpen,
    setIsVisualEditorOpen,

    isAIChatOpen,
    setIsAIChatOpen,
    aiChatFocused,
    toggleAIChatFocused,
    aiChatMode: state.aiChatMode,
    setAIChatMode,
    aiChatEndpoint,
    aiChatOptions,

    isSettingsOpen,
    setIsSettingsOpen,
    closeSettings,

    isDocOpen,
    setIsDocOpen,
    closeDoc,

    theme,
    setTheme,

    username,
    setUsername,

    isDirectoryOpen,
    toggleDirectory,

    editorCache,
    editorWantsFocus,
    editorNoLongerWantsFocus,

    errorMessage,

    handleRuntimeError,
    clearRuntimeError,

    isCreateFileModalOpen,
    handleOpenCreateFileModal,
    handleCloseCreateFileModal,
    handleCreateFileClick,
    isCreateDirModalOpen,
    handleOpenCreateDirModal,
    handleCloseCreateDirModal,
    handleCreateDirClick,
    runPrettierRef,
    runCodeRef,
    sidebarRef,
    codeEditorRef,
    iframeRef,

    connected,
    pending,

    hoveredItemId,
    setHoveredItemId,

    enableAutoFollow,
    toggleAutoFollow,
    updatePresenceIndicator,
    sidebarPresenceIndicators,
    splitCurrentPane,
    liveKitRoomName,
    setLiveKitRoom,
    liveKitToken,
    setLiveKitToken,
    liveKitConnection,
    setLiveKitConnection,
    voiceChatModalOpen,
    setVoiceChatModalOpen,

    aiChatMessage,
    setAIChatMessage,
    currentChatId,
    selectedChatId,
    setSelectedChatId,
    aiErrorMessage,
    setAIErrorMessage,
    handleSendMessage,

    // Message history navigation
    navigateMessageHistoryUp,
    navigateMessageHistoryDown,
    resetMessageHistoryNavigation,

    // Auto-fork functions for VizHub integration
    autoForkAndRetryAI,
    clearStoredAIPrompt,
    getStoredAIPrompt,

    // Additional widgets that can be rendered in AI chat messages
    additionalWidgets,

    // Feature flags
    enableMinimalEditFlow,

    // Analytics callback for chat message submissions
    onAIChatMessageSubmitted,
  };
};
