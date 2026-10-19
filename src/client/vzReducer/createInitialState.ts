import { VZState } from '.';
import { Username, VZInitialSidebarView } from '../../types';
import { ThemeLabel } from '../themes';

export const createInitialState = ({
  defaultTheme,
  initialUsername = 'Anonymous',
  initialSidebarView = 'ai-chat',
}: {
  defaultTheme: ThemeLabel;
  initialUsername?: Username;
  initialSidebarView?: VZInitialSidebarView;
}): VZState => ({
  pane: {
    id: 'root',
    type: 'leafPane',
    tabList: [],
    activeFileId: null,
  },
  activePaneId: 'root',
  theme: defaultTheme,
  search: {
    pattern: '',
    results: {},
    focused: false,
    focusedIndex: null,
    focusedChildIndex: null,
  },
  isVisualEditorOpen: initialSidebarView === 'visual',
  isSearchOpen: false,
  isAIChatOpen: initialSidebarView === 'ai-chat',
  aiChatFocused: false,
  aiChatMode: 'edit',
  isSettingsOpen: false,
  isDocOpen: false,
  editorWantsFocus: false,
  username: initialUsername,
  enableAutoFollow: false,
  sidebarPresenceIndicators: [],
});
