import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/client/vzReducer/createInitialState';

describe('embedded sidebar initial view', () => {
  const defaultTheme = 'dark';
  it('preserves standalone VZCode AI-chat default', () => {
    const state = createInitialState({ defaultTheme: defaultTheme as never });
    expect(state.isAIChatOpen).toBe(true);
    expect(state.isVisualEditorOpen).toBe(false);
  });
  it('opens visual controls when requested by an embedding host', () => {
    const state = createInitialState({ defaultTheme: defaultTheme as never, initialSidebarView: 'visual' });
    expect(state.isAIChatOpen).toBe(false);
    expect(state.isVisualEditorOpen).toBe(true);
  });
});
