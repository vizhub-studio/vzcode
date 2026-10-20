/**
 * Utility functions for scrolling behavior in the AI editing interface
 * Part of Phase 2: Diff-First Review Experience
 */

/**
 * Scrolls to the first diff hunk in a diff container
 * Accounts for fixed headers and navigation
 * @param diffContainer - The container element with diff content
 * @param headerOffset - Offset for fixed headers (default: 60px)
 */
export const scrollToFirstDiff = (
  diffContainer: HTMLElement,
  headerOffset: number = 60,
): void => {
  // Look for the first diff hunk row
  const firstHunk = diffContainer.querySelector(
    '.d2h-diff-tbody tr',
  );

  if (firstHunk) {
    // Scroll to the first hunk with header offset
    firstHunk.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });

    // Adjust for fixed headers
    window.scrollBy(0, -headerOffset);

    // Set focus for keyboard navigation accessibility
    if (diffContainer.setAttribute) {
      diffContainer.tabIndex = -1;
      diffContainer.focus();
    }
  }
};

/**
 * Gets the first diff anchor element for scroll targeting
 * @param diffContainer - The container element with diff content
 * @returns The first diff element or null if not found
 */
export const getFirstDiffAnchor = (
  diffContainer: HTMLElement,
): HTMLElement | null => {
  // Try different selectors for various diff formats
  const selectors = [
    '.d2h-diff-tbody tr:first-child', // diff2html format
    '.diff-line:first-child', // alternative format
    '.hunk:first-child', // git diff format
    '.d2h-file-wrapper:first-child', // file-level anchor
  ];

  for (const selector of selectors) {
    const element = diffContainer.querySelector(selector);
    if (element) {
      return element as HTMLElement;
    }
  }

  return null;
};

/**
 * Scrolls to a specific element with header-aware offset
 * @param element - The element to scroll to
 * @param headerOffset - Offset for fixed headers (default: 60px)
 * @param behavior - Scroll behavior ('smooth' or 'auto')
 */
export const scrollToElementWithOffset = (
  element: HTMLElement,
  headerOffset: number = 60,
  behavior: ScrollBehavior = 'smooth',
): void => {
  element.scrollIntoView({
    behavior,
    block: 'start',
  });

  // Adjust for fixed headers
  window.scrollBy(0, -headerOffset);
};

/**
 * Gets the appropriate header offset by measuring actual header height
 * Falls back to default if header elements not found
 * @param defaultOffset - Default offset if header not found (default: 60px)
 * @returns The calculated header offset
 */
export const getHeaderOffset = (
  defaultOffset: number = 60,
): number => {
  // Try to find the actual header element
  const header =
    document.querySelector('#appHeader') ||
    document.querySelector('.app-header') ||
    document.querySelector('header');

  if (header) {
    return header.getBoundingClientRect().height;
  }

  return defaultOffset;
};

/**
 * Handles edge cases for diff scrolling
 * @param diffContainer - The container element with diff content
 * @returns Object describing the diff state
 */
export const analyzeDiffContent = (
  diffContainer: HTMLElement,
) => {
  const fileWrappers = diffContainer.querySelectorAll(
    '.d2h-file-wrapper',
  );
  const diffLines = diffContainer.querySelectorAll(
    '.d2h-diff-tbody tr',
  );

  return {
    hasFiles: fileWrappers.length > 0,
    fileCount: fileWrappers.length,
    hasDiffLines: diffLines.length > 0,
    diffLineCount: diffLines.length,
    isEmpty:
      fileWrappers.length === 0 && diffLines.length === 0,
    isMultiFile: fileWrappers.length > 1,
  };
};

/**
 * Announces diff summary for screen readers
 * @param diffContainer - The container element with diff content
 */
export const announceDiffSummary = (
  diffContainer: HTMLElement,
): void => {
  const analysis = analyzeDiffContent(diffContainer);

  let announcement = '';

  if (analysis.isEmpty) {
    announcement = 'No changes to review';
  } else if (analysis.isMultiFile) {
    announcement = `${analysis.fileCount} files changed. Review diff content.`;
  } else {
    announcement = `1 file changed. Review diff content.`;
  }

  // Create or update ARIA live region for announcements
  let liveRegion = document.getElementById(
    'diff-announcements',
  );
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'diff-announcements';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
  }

  liveRegion.textContent = announcement;
};
