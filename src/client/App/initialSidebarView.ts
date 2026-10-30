import type { VZInitialSidebarView } from '../../types';

/**
 * Chooses the sidebar shown when the standalone app first loads.
 * A URL that names a file (`?file=styles.css`) opens the Files
 * panel so the file's tree entry is visible; otherwise the
 * historical AI chat default is kept.
 */
export const getInitialSidebarViewFromSearch = (
  search: string,
): VZInitialSidebarView => {
  const file = new URLSearchParams(search).get('file');
  return file ? 'files' : 'ai-chat';
};
