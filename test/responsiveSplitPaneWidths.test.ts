import { describe, expect, it } from 'vitest';
import { getConstrainedPaneWidths } from '../src/client/SplitPaneResizeContext';

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
    expect(panes.codeEditorWidth).toBeGreaterThanOrEqual(
      0,
    );
    expect(
      panes.sidebarWidth + panes.codeEditorWidth,
    ).toBeLessThanOrEqual(320);
  });
});
