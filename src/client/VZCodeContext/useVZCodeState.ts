import {
  useCallback,
  useEffect,
  useMemo,
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
import { v4 as uuidv4 } from 'uuid';
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
    { defaultTheme, initialUsername },
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

  const [aiChatMessage, setAIChatMessage] = useState('');

  const DEBUG = false;

  // Compute isLoading based on the current chat's aiStatus
  // Chat ID changes with each new user message (but not for retry/undo)
  const [currentChatId, setCurrentChatId] = useState(() =>
    uuidv4(),
  );
  const [selectedChatId, setSelectedChatId] = useState<
    string | null
  >(null);

  // Use selectedChatId if available, otherwise use currentChatId for backward compatibility
  const activeChatId = selectedChatId || currentChatId;
  const currentChat = content?.chats?.[activeChatId];

  // Message history for up/down arrow navigation - using ShareDB document data
  const messageHistory = useMemo(() => {
    if (!currentChat?.messages) return [];
    // Extract user messages in chronological order for history navigation
    return currentChat.messages
      .filter((msg) => msg.role === 'user')
      .map((msg) => msg.content);
  }, [currentChat?.messages]);

  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDraft, setCurrentDraft] = useState('');

  const [aiErrorMessage, setAIErrorMessageState] = useState<
    string | null
  >(null);

  // Create the combined setAIErrorMessage function that calls both state setter and external callback
  const setAIErrorMessage = useCallback(
    (error: string | null, message?: string) => {
      setAIErrorMessageState(error);
      if (error && handleChatError) {
        handleChatError(error, message);
      }
    },
    [handleChatError],
  );

  // Phase 5: Restore the prompt into the chat input when the server
  // populates `currentChatDraft` (e.g. after Undo), then clear it so it
  // is applied exactly once.
  useEffect(() => {
    const draft = (content as any)?.currentChatDraft;
    if (typeof draft === 'string' && draft.trim()) {
      setAIChatMessage(draft);
      submitOperation((currentContent) => {
        const next: any = { ...currentContent };
        next.currentChatDraft = undefined;
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(content as any)?.currentChatDraft]);

  // Message history navigation functions
  const navigateMessageHistoryUp = useCallback(() => {
    if (messageHistory.length === 0) return;

    // If we're not navigating history, save current draft
    if (historyIndex === -1) {
      setCurrentDraft(aiChatMessage);
    }

    const newIndex =
      historyIndex < messageHistory.length - 1
        ? historyIndex + 1
        : historyIndex;
    setHistoryIndex(newIndex);
    setAIChatMessage(
      messageHistory[messageHistory.length - 1 - newIndex],
    );
  }, [messageHistory, historyIndex, aiChatMessage]);

  const navigateMessageHistoryDown = useCallback(() => {
    if (historyIndex === -1) return;

    const newIndex = historyIndex - 1;
    if (newIndex === -1) {
      // Return to draft
      setHistoryIndex(-1);
      setAIChatMessage(currentDraft);
      setCurrentDraft('');
    } else {
      setHistoryIndex(newIndex);
      setAIChatMessage(
        messageHistory[
          messageHistory.length - 1 - newIndex
        ],
      );
    }
  }, [messageHistory, historyIndex, currentDraft]);

  const resetMessageHistoryNavigation = useCallback(() => {
    if (historyIndex !== -1) {
      setHistoryIndex(-1);
      setCurrentDraft('');
    }
  }, [historyIndex]);

  const handleSendMessage = useCallback(
    async (
      messageToSend?: string,
      options?: Record<string, string>,
    ) => {
      DEBUG &&
        console.log(
          'AIChat: handleSendMessage called with:',
          messageToSend,
          'aiChatMessage:',
          aiChatMessage,
        );
      const messageContent = messageToSend || aiChatMessage;

      if (
        !messageContent ||
        typeof messageContent !== 'string' ||
        !messageContent.trim()
      ) {
        return;
      }

      const currentPrompt = aiChatMessage.trim();
      setAIChatMessage('');

      // Reset history navigation when sending a message
      setHistoryIndex(-1);
      setCurrentDraft('');

      setAIErrorMessage(null); // Clear any previous errors

      // Track AI chat message submission
      const isRetry = options?.isRetry === 'true';
      const isUndo = options?.isUndo === 'true';
      if (
        !DEBUG &&
        onAIChatMessageSubmitted &&
        aiChatOptions?.vizId
      ) {
        onAIChatMessageSubmitted({
          messageLength: messageContent.trim().length,
          isRetry,
          isUndo,
        });
      }

      // Generate new chat ID only for fresh user messages
      // Keep existing chat ID for retries (Try Harder) and undos
      const isRetryOrUndo =
        options?.isRetry === 'true' ||
        options?.isUndo === 'true';

      let chatIdForRequest: string;
      if (isRetryOrUndo) {
        // Use existing chat ID for retry/undo operations
        chatIdForRequest = activeChatId;
        DEBUG &&
          console.log(
            'Using existing chatId for retry/undo:',
            chatIdForRequest,
          );
      } else {
        // Generate NEW chat ID for fresh user message
        const newChatId = uuidv4();
        setCurrentChatId(newChatId);
        setSelectedChatId(newChatId);
        chatIdForRequest = newChatId;
        DEBUG &&
          console.log(
            'Generated new chatId for fresh message:',
            chatIdForRequest,
          );
      }

      // Call backend endpoint for AI response
      try {
        const response = await fetch(aiChatEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...aiChatOptions,
            content: messageContent.trim(),
            chatId: chatIdForRequest,
            mode: aiChatMode,
            ...options,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}`,
          );
        }

        // Parse the response to check for errors
        const responseData = await response.json();

        // Check if the response contains a VizHub error
        if (
          responseData.outcome === 'failure' &&
          responseData.error
        ) {
          const errorMessage = responseData.error.message;

          // Check if this is the specific permission error that should trigger auto-fork
          if (
            errorMessage ===
            'You do not have permission to use AI chat on this visualization. Only users with edit access can use this feature. Fork the viz to edit it.'
          ) {
            // For authenticated users, trigger auto-fork
            if (autoForkAndRetryAI) {
              try {
                await autoForkAndRetryAI(
                  currentPrompt,
                  aiChatMode,
                );
                // If we reach here, the fork was successful and redirect should happen
                return;
              } catch (forkError) {
                console.error(
                  'Auto-fork failed:',
                  forkError,
                );
                setAIErrorMessage(
                  'Failed to fork visualization. Please try forking manually.',
                );
                return;
              }
            } else {
              // For unauthenticated users, store the message and trigger login flow
              // This will be handled by the external error handler
              setAIErrorMessage(
                errorMessage,
                messageContent.trim(),
              );
              return;
            }
          }

          // For other errors, show the error message
          setAIErrorMessage(
            errorMessage,
            messageContent.trim(),
          );
          return;
        }

        // The backend handles all ShareDB operations for successful responses
        // The loading state is now managed via ShareDB aiStatus
        return responseData;
      } catch (error) {
        console.error('Error getting AI response:', error);
        setAIErrorMessage(
          'Failed to send message. Please try again.',
          messageContent.trim(),
        );
      }
    },
    [
      aiChatMessage,
      aiChatEndpoint,
      aiChatOptions,
      activeChatId,
      aiChatMode,
      autoForkAndRetryAI,
      DEBUG,
      setAIErrorMessage,
    ],
  );

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
