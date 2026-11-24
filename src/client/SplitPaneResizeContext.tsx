// From https://github.com/vizhub-core/vizhub/edit/main/vizhub-v2/packages/neoFrontend/src/pages/VizPage/SplitPaneResizeContext/index.js
import {
  createContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';

export type Side = 'left' | 'right';
export type PreviewMode = 'internal' | 'external';

export type SplitPaneResizeContextValue = {
  previewMode: PreviewMode;
  codeEditorWidth: number;
  sidebarWidth: number;
  moveSplitPane: (a: number, side: Side) => void;
  isDraggingRight: boolean;
  isDraggingLeft: boolean;
  setIsDragging: (a: boolean, side: Side) => void;
  setSidebarView: (isAIChatOpen: boolean) => void;
  setContainerWidth: (width: number) => void;
};

// Default widths for different sidebar views
const filesViewWidth = 300;
const aiChatViewWidth = 800;
const initialCodeEditorWidthDefault = 800;

// Preserve a usable preview and code pane as the host workspace narrows.
const minFilesWidth = 220;
const minAIChatWidth = 300;
const minCodeEditorWidth = 200;
const minPreviewWidth = 320;
const previewShare = 0.32;

const initialValue: SplitPaneResizeContextValue = {
  previewMode: 'internal',
  codeEditorWidth: initialCodeEditorWidthDefault,
  sidebarWidth: filesViewWidth, // Default to files view
  moveSplitPane: () => {},
  isDraggingRight: false,
  isDraggingLeft: false,
  setIsDragging: () => {},
  setSidebarView: () => {},
  setContainerWidth: () => {},
};

export const SplitPaneResizeContext =
  createContext<SplitPaneResizeContextValue>(initialValue);

type SplitPaneState = {
  // Preferred widths; actual widths are bounded by the workspace size.
  sidebarWidth: number;
  codeEditorWidth: number;
  containerWidth: number | null;
  isAIChatOpen: boolean;
  isDraggingLeft: boolean;
  isDraggingRight: boolean;
};

const initialState: SplitPaneState = {
  sidebarWidth: filesViewWidth,
  codeEditorWidth: initialCodeEditorWidthDefault,
  containerWidth: null,
  isAIChatOpen: false,
  isDraggingLeft: false,
  isDraggingRight: false,
};

// Keep preferred widths intact when the workspace temporarily shrinks, so
// the user's drag choices return when there is room again.
export const getConstrainedPaneWidths = (
  state: SplitPaneState,
  previewMode: PreviewMode = 'internal',
) => {
  const {
    sidebarWidth,
    codeEditorWidth,
    containerWidth,
    isAIChatOpen,
  } = state;
  if (containerWidth === null) {
    return { sidebarWidth, codeEditorWidth };
  }

  const availableWidth = Math.max(0, containerWidth);
  const previewWidth =
    previewMode === 'external'
      ? 0
      : Math.min(
          Math.max(
            minPreviewWidth,
            availableWidth * previewShare,
          ),
          availableWidth * 0.45,
        );
  const sidebarMinimum = Math.min(
    isAIChatOpen ? minAIChatWidth : minFilesWidth,
    Math.max(
      0,
      availableWidth -
        previewWidth -
        (previewMode === 'external'
          ? Math.min(minCodeEditorWidth, availableWidth)
          : 0),
    ),
  );
  const codeMinimum = Math.min(
    minCodeEditorWidth,
    Math.max(
      0,
      availableWidth - previewWidth - sidebarMinimum,
    ),
  );
  const sidebarMaximum = Math.max(
    sidebarMinimum,
    availableWidth - previewWidth - codeMinimum,
  );
  const constrainedSidebarWidth = Math.min(
    Math.max(sidebarWidth, sidebarMinimum),
    sidebarMaximum,
  );
  const remainingWidth = Math.max(
    0,
    availableWidth - constrainedSidebarWidth - previewWidth,
  );
  const constrainedCodeEditorWidth =
    previewMode === 'external'
      ? remainingWidth
      : Math.min(
          Math.max(0, codeEditorWidth),
          remainingWidth,
        );
  return {
    sidebarWidth: constrainedSidebarWidth,
    codeEditorWidth: constrainedCodeEditorWidth,
  };
};

type SplitPaneAction =
  | {
      type: 'move';
      side: Side;
      movementX: number;
    }
  | {
      type: 'setIsDragging';
      side: Side;
      isDragging: boolean;
    }
  | {
      type: 'setSidebarView';
      isAIChatOpen: boolean;
    }
  | {
      type: 'setContainerWidth';
      width: number;
    };

export const splitPaneReducer = (
  state: SplitPaneState,
  action: SplitPaneAction,
  previewMode: PreviewMode = 'internal',
) => {
  switch (action.type) {
    case 'move': {
      if (
        previewMode === 'external' &&
        action.side === 'right'
      ) {
        return state;
      }
      const { sidebarWidth, codeEditorWidth } =
        getConstrainedPaneWidths(state, previewMode);
      return action.side === 'left'
        ? {
            ...state,
            sidebarWidth: sidebarWidth + action.movementX,
          }
        : {
            ...state,
            codeEditorWidth:
              codeEditorWidth + action.movementX,
          };
    }
    // Handle setIsDragging
    case 'setIsDragging':
      return action.side === 'left'
        ? {
            ...state,
            isDraggingLeft: action.isDragging,
          }
        : {
            ...state,
            isDraggingRight: action.isDragging,
          };
    case 'setSidebarView':
      return {
        ...state,
        isAIChatOpen: action.isAIChatOpen,
        sidebarWidth: action.isAIChatOpen
          ? aiChatViewWidth
          : filesViewWidth,
      };
    case 'setContainerWidth':
      return state.containerWidth === action.width
        ? state
        : { ...state, containerWidth: action.width };
    default:
      return state;
  }
};

export const SplitPaneResizeProvider = ({
  children,
  previewMode = 'internal',
}: {
  children?: ReactNode;
  /** External hosts own the preview split; code fills the remainder. */
  previewMode?: PreviewMode;
}) => {
  const reducer = useCallback(
    (state: SplitPaneState, action: SplitPaneAction) =>
      splitPaneReducer(state, action, previewMode),
    [previewMode],
  );
  const [state, dispatch] = useReducer(
    reducer,
    initialState,
  );

  const setIsDragging = useCallback(
    (isDragging: boolean, side: Side) => {
      dispatch({ type: 'setIsDragging', isDragging, side });
    },
    [dispatch],
  );

  const moveSplitPane = useCallback(
    (movementX: number, side: Side) => {
      dispatch({ type: 'move', movementX, side });
    },
    [dispatch],
  );

  const setSidebarView = useCallback(
    (isAIChatOpen: boolean) => {
      dispatch({ type: 'setSidebarView', isAIChatOpen });
    },
    [dispatch],
  );

  const setContainerWidth = useCallback((width: number) => {
    dispatch({ type: 'setContainerWidth', width });
  }, []);

  const { sidebarWidth, codeEditorWidth } =
    getConstrainedPaneWidths(state, previewMode);
  const { isDraggingLeft, isDraggingRight } = state;

  const value: SplitPaneResizeContextValue = {
    previewMode,
    codeEditorWidth,
    sidebarWidth,
    moveSplitPane,
    isDraggingLeft,
    isDraggingRight,
    setIsDragging,
    setSidebarView,
    setContainerWidth,
  };

  return (
    <SplitPaneResizeContext.Provider value={value}>
      {children}
    </SplitPaneResizeContext.Provider>
  );
};
