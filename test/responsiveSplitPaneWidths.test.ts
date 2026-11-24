import { describe, expect, it } from 'vitest';
import {
  getConstrainedPaneWidths,
  splitPaneReducer,
} from '../src/client/SplitPaneResizeContext';

const chatLayout = {
  sidebarWidth: 800,
  codeEditorWidth: 800,
  containerWidth: 1700,
  isAIChatOpen: true,
  isDraggingLeft: false,
  isDraggingRight: false,
};

describe('responsive split pane widths', () => {
  it('preserves a useful preview beside an open AI chat', () => {
    const panes = getConstrainedPaneWidths(chatLayout);
    expect(panes.sidebarWidth).toBe(800);
    expect(panes.codeEditorWidth).toBeCloseTo(356);
    expect(
      1700 - panes.sidebarWidth - panes.codeEditorWidth,
    ).toBeCloseTo(544);
  });

  it('shrinks the chat and code panes in a narrow workspace', () => {
    const panes = getConstrainedPaneWidths({
      ...chatLayout,
      containerWidth: 1000,
    });
    expect(panes.sidebarWidth).toBe(480);
    expect(panes.codeEditorWidth).toBe(200);
    expect(
      1000 - panes.sidebarWidth - panes.codeEditorWidth,
    ).toBe(320);
  });

  it('restores preferred widths when the workspace grows', () => {
    const narrow = getConstrainedPaneWidths({
      ...chatLayout,
      containerWidth: 1000,
    });
    const wide = getConstrainedPaneWidths({
      ...chatLayout,
      containerWidth: 2560,
    });
    expect(narrow.sidebarWidth).toBeLessThan(
      wide.sidebarWidth,
    );
    expect(wide.sidebarWidth).toBe(800);
    expect(wide.codeEditorWidth).toBe(800);
  });

  it('allows the Files sidebar to be narrower than chat', () => {
    const files = getConstrainedPaneWidths({
      ...chatLayout,
      sidebarWidth: 300,
      containerWidth: 700,
      isAIChatOpen: false,
    });
    expect(files.sidebarWidth).toBe(220);
    expect(
      files.sidebarWidth + files.codeEditorWidth,
    ).toBeLessThanOrEqual(700);
  });

  it('never returns negative widths on small containers', () => {
    const panes = getConstrainedPaneWidths({
      ...chatLayout,
      containerWidth: 320,
    });
    expect(panes.sidebarWidth).toBeGreaterThanOrEqual(0);
    expect(panes.codeEditorWidth).toBeGreaterThanOrEqual(0);
    expect(
      panes.sidebarWidth + panes.codeEditorWidth,
    ).toBeLessThanOrEqual(320);
  });
});

const filesLayout = {
  ...chatLayout,
  sidebarWidth: 300,
  isAIChatOpen: false,
};

describe('externally managed preview', () => {
  it.each([0, 150, 320, 420, 700, 912, 1200, 2560])(
    'fills the entire editor container at %ipx',
    (containerWidth) => {
      const panes = getConstrainedPaneWidths(
        { ...filesLayout, containerWidth },
        'external',
      );
      expect(panes.sidebarWidth).toBeGreaterThanOrEqual(0);
      expect(panes.codeEditorWidth).toBeGreaterThanOrEqual(0);
      expect(
        panes.sidebarWidth + panes.codeEditorWidth,
      ).toBeCloseTo(containerWidth);
      expect(panes.codeEditorWidth).toBeGreaterThanOrEqual(
        Math.min(200, containerWidth),
      );
    },
  );

  it('expands beyond the preferred code width', () => {
    const panes = getConstrainedPaneWidths(
      { ...filesLayout, containerWidth: 1600 },
      'external',
    );
    expect(panes).toEqual({
      sidebarWidth: 300,
      codeEditorWidth: 1300,
    });
  });

  it('constrains chat without reserving a second preview', () => {
    const narrow = getConstrainedPaneWidths(
      { ...chatLayout, containerWidth: 650 },
      'external',
    );
    expect(narrow).toEqual({
      sidebarWidth: 450,
      codeEditorWidth: 200,
    });
    expect(
      getConstrainedPaneWidths(chatLayout, 'external'),
    ).toEqual({ sidebarWidth: 800, codeEditorWidth: 900 });
  });

  it('reallocates width when the left divider moves', () => {
    const state = { ...filesLayout, containerWidth: 900 };
    const moved = splitPaneReducer(
      state,
      { type: 'move', side: 'left', movementX: 100 },
      'external',
    );
    expect(
      getConstrainedPaneWidths(moved, 'external'),
    ).toEqual({ sidebarWidth: 400, codeEditorWidth: 500 });
    expect(
      splitPaneReducer(
        moved,
        { type: 'move', side: 'right', movementX: 100 },
        'external',
      ),
    ).toBe(moved);
    const shrunk = splitPaneReducer(
      moved,
      { type: 'setContainerWidth', width: 500 },
      'external',
    );
    expect(
      getConstrainedPaneWidths(shrunk, 'external'),
    ).toEqual({ sidebarWidth: 300, codeEditorWidth: 200 });
    expect(
      getConstrainedPaneWidths(
        splitPaneReducer(
          shrunk,
          { type: 'setContainerWidth', width: 900 },
          'external',
        ),
        'external',
      ),
    ).toEqual({ sidebarWidth: 400, codeEditorWidth: 500 });
  });
});
