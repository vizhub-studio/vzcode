import { describe, expect, it } from 'vitest';
import { getInitialSidebarViewFromSearch } from '../src/client/App/initialSidebarView';
import { createInitialState } from '../src/client/vzReducer/createInitialState';

describe('getInitialSidebarViewFromSearch', () => {
  it('opens Files when a file is named in the URL', () => {
    expect(
      getInitialSidebarViewFromSearch('?file=styles.css'),
    ).toBe('files');
  });
  it('keeps AI chat when no file is named', () => {
    expect(getInitialSidebarViewFromSearch('')).toBe(
      'ai-chat',
    );
    expect(
      getInitialSidebarViewFromSearch('?tabs=abc'),
    ).toBe('ai-chat');
  });
  it('ignores an empty file parameter', () => {
    expect(getInitialSidebarViewFromSearch('?file=')).toBe(
      'ai-chat',
    );
  });
  it('opens Files in the reducer state, not AI chat', () => {
    const state = createInitialState({
      defaultTheme: 'dark' as never,
      initialSidebarView: getInitialSidebarViewFromSearch(
        '?file=styles.css',
      ),
    });
    expect(state.isAIChatOpen).toBe(false);
    expect(state.isVisualEditorOpen).toBe(false);
  });
});
