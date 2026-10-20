import { describe, it, expect } from 'vitest';
import {
  vzReducer,
  createInitialState,
  VZState,
  VZAction,
} from '../src/client/vzReducer';
import { defaultTheme } from '../src/client/themes';
import type { PresenceIndicator } from '../src/types';

const base = (): VZState =>
  createInitialState({ defaultTheme });

const withTabs = (
  fileIds: string[],
  activeFileId?: string,
): VZState => {
  const state = base();
  return {
    ...state,
    pane: {
      ...state.pane,
      tabList: fileIds.map((fileId) => ({
        fileId,
        isTransient: false,
      })),
      activeFileId: activeFileId ?? fileIds[0] ?? null,
    },
  };
};

const leaf = (state: VZState) => {
  if (state.pane.type !== 'leafPane') {
    throw new Error('Expected a leaf pane');
  }
  return state.pane;
};

describe('vzReducer actions', () => {
  it('sets the theme', () => {
    const state = vzReducer(base(), {
      type: 'set_theme',
      themeLabel: 'nord',
    });
    expect(state.theme).toBe('nord');
  });

  it('sets the username', () => {
    const state = vzReducer(base(), {
      type: 'set_username',
      username: 'Ada',
    });
    expect(state.username).toBe('Ada');
  });

  it('sets whether settings and docs are open', () => {
    const opened = vzReducer(base(), {
      type: 'set_is_settings_open',
      value: true,
    });
    expect(opened.isSettingsOpen).toBe(true);
    const closed = vzReducer(opened, {
      type: 'set_is_settings_open',
      value: false,
    });
    expect(closed.isSettingsOpen).toBe(false);

    const docOpen = vzReducer(base(), {
      type: 'set_is_doc_open',
      value: true,
    });
    expect(docOpen.isDocOpen).toBe(true);
  });

  it('sets whether the visual editor is open', () => {
    const state = vzReducer(base(), {
      type: 'set_is_visual_editor_open',
      value: true,
    });
    expect(state.isVisualEditorOpen).toBe(true);
  });

  it('opening AI chat closes search', () => {
    const stateWithSearch = {
      ...base(),
      isSearchOpen: true,
    };
    const state = vzReducer(stateWithSearch, {
      type: 'set_is_ai_chat_open',
      value: true,
    });
    expect(state.isAIChatOpen).toBe(true);
    expect(state.isSearchOpen).toBe(false);
  });

  it('closing AI chat leaves search untouched', () => {
    const stateWithSearch = {
      ...base(),
      isAIChatOpen: true,
      isSearchOpen: true,
    };
    const state = vzReducer(stateWithSearch, {
      type: 'set_is_ai_chat_open',
      value: false,
    });
    expect(state.isAIChatOpen).toBe(false);
    expect(state.isSearchOpen).toBe(true);
  });

  it('toggles AI chat focus and sets the mode', () => {
    const focused = vzReducer(base(), {
      type: 'toggle_ai_chat_focused',
    });
    expect(focused.aiChatFocused).toBe(true);
    const blurred = vzReducer(focused, {
      type: 'toggle_ai_chat_focused',
    });
    expect(blurred.aiChatFocused).toBe(false);

    const ask = vzReducer(base(), {
      type: 'set_ai_chat_mode',
      mode: 'ask',
    });
    expect(ask.aiChatMode).toBe('ask');
  });

  it('toggles auto-follow', () => {
    const on = vzReducer(base(), {
      type: 'toggle_auto_follow',
    });
    expect(on.enableAutoFollow).toBe(true);
    const off = vzReducer(on, {
      type: 'toggle_auto_follow',
    });
    expect(off.enableAutoFollow).toBe(false);
  });

  it('adds and updates presence indicators', () => {
    const ada: PresenceIndicator = {
      username: 'Ada',
      fileId: 'file1',
    };
    const added = vzReducer(base(), {
      type: 'update_presence_indicator',
      presenceIndicator: ada,
    });
    expect(added.sidebarPresenceIndicators).toEqual([ada]);

    const moved: PresenceIndicator = {
      username: 'Ada',
      fileId: 'file2',
    };
    const updated = vzReducer(added, {
      type: 'update_presence_indicator',
      presenceIndicator: moved,
    });
    expect(updated.sidebarPresenceIndicators).toEqual([
      moved,
    ]);

    const bob: PresenceIndicator = {
      username: 'Bob',
      fileId: 'file1',
    };
    const withBob = vzReducer(updated, {
      type: 'update_presence_indicator',
      presenceIndicator: bob,
    });
    expect(withBob.sidebarPresenceIndicators).toEqual([
      moved,
      bob,
    ]);
  });

  it('splits the current pane into two leaf panes', () => {
    const state = vzReducer(base(), {
      type: 'split_current_pane',
    });
    expect(state.pane.type).toBe('splitPane');
    if (state.pane.type === 'splitPane') {
      expect(state.pane.children).toHaveLength(2);
      expect(state.pane.children[0].id).toBe('root-1');
      expect(state.pane.children[1].id).toBe('root-2');
    }
    expect(state.activePaneId).toBe('root-1');
  });

  it('moves the active file left and right, wrapping around', () => {
    const state = withTabs(['f1', 'f2', 'f3'], 'f2');
    const left = vzReducer(state, {
      type: 'set_active_file_left',
    });
    expect(leaf(left).activeFileId).toBe('f1');
    const right = vzReducer(state, {
      type: 'set_active_file_right',
    });
    expect(leaf(right).activeFileId).toBe('f3');

    const wrapLeft = vzReducer(
      withTabs(['f1', 'f2', 'f3'], 'f1'),
      { type: 'set_active_file_left' },
    );
    expect(leaf(wrapLeft).activeFileId).toBe('f3');
    const wrapRight = vzReducer(
      withTabs(['f1', 'f2', 'f3'], 'f3'),
      { type: 'set_active_file_right' },
    );
    expect(leaf(wrapRight).activeFileId).toBe('f1');
  });

  it('sets the active file id', () => {
    const state = withTabs(['f1', 'f2'], 'f1');
    const next = vzReducer(state, {
      type: 'set_active_file_id',
      activeFileId: 'f2',
    });
    expect(leaf(next).activeFileId).toBe('f2');
  });

  it('closes tabs and picks a neighboring active tab', () => {
    const state = withTabs(['f1', 'f2', 'f3'], 'f2');
    const closed = vzReducer(state, {
      type: 'close_tabs',
      fileIdsToClose: ['f2'],
    });
    expect(
      leaf(closed).tabList.map((tab) => tab.fileId),
    ).toEqual(['f1', 'f3']);
    // Prefers the tab to the left of the closed one.
    expect(leaf(closed).activeFileId).toBe('f1');

    const closedAll = vzReducer(state, {
      type: 'close_tabs',
      fileIdsToClose: ['f1', 'f2', 'f3'],
    });
    expect(leaf(closedAll).tabList).toEqual([]);
    expect(leaf(closedAll).activeFileId).toBeNull();
  });

  it('keeps the active tab when closing a different tab', () => {
    const state = withTabs(['f1', 'f2'], 'f1');
    const closed = vzReducer(state, {
      type: 'close_tabs',
      fileIdsToClose: ['f2'],
    });
    expect(leaf(closed).activeFileId).toBe('f1');
    expect(
      leaf(closed).tabList.map((tab) => tab.fileId),
    ).toEqual(['f1']);
  });

  it('clears editor focus on editor_no_longer_wants_focus', () => {
    const state = {
      ...base(),
      editorWantsFocus: true,
    };
    const next = vzReducer(state, {
      type: 'editor_no_longer_wants_focus',
    });
    expect(next.editorWantsFocus).toBe(false);
  });

  it('returns the same state for unknown actions', () => {
    const state = base();
    const next = vzReducer(state, {
      type: 'not_a_real_action',
    } as unknown as VZAction);
    expect(next).toBe(state);
  });
});
