import { useState, useCallback, useEffect } from 'react';
import type { Pane } from '../types';
import { VizContent } from '@vizhub/viz-types';

// When a page is opened with an active file,
// make sure all the directories leading to that file
// are opened automatically.
export const initialOpenDirectories = (
  activeFile: string | null,
): Set<VZPath> => {
  const openDirectories = new Set<VZPath>();
  if (activeFile) {
    const path = activeFile.split('/');
    for (let i = 1; i < path.length; i++) {
      openDirectories.add(path.slice(0, i).join('/'));
    }
  }
  return openDirectories;
};

type VZPath = string;

// Inspired by
// https://github.com/vizhub-core/vizhub/blob/main/vizhub-v2/packages/neoFrontend/src/pages/VizPage/Body/Editor/FilesSection/useOpenDirectories.js
// TODO move this into reducer
export const useOpenDirectories = ({
  activePane,
  content,
}: {
  activePane: Pane;
  content: VizContent;
}): {
  isDirectoryOpen: (path: VZPath) => boolean;
  toggleDirectory: (path: VZPath) => void;
} => {
  // The set of open directories by path/
  const [openDirectories, setOpenDirectories] = useState<
    Set<VZPath>
  >(new Set());

  // (client-side only) initialize the open directories
  // based on the open files from the URL params.
  useEffect(() => {
    if (
      activePane.type === 'leafPane' &&
      activePane?.activeFileId &&
      content.files &&
      content.files[activePane.activeFileId]
    ) {
      const activeFileId = activePane.activeFileId;
      const fileName = content.files[activeFileId].name;
      const dirsToOpen = initialOpenDirectories(fileName);
      setOpenDirectories((prev) => {
        const updated = new Set(prev);
        for (const dir of dirsToOpen) {
          updated.add(dir);
        }
        return updated;
      });
    }
  }, [activePane, content?.files]);

  // Whether a directory is open.
  const isDirectoryOpen: (path: VZPath) => boolean =
    useCallback(
      (path) => openDirectories.has(path),
      [openDirectories],
    );

  /**
   * Toggles the state of a directory (open/close).
   * If the directory is currently open, it will close it.
   * If it's closed, it will open it.
   */
  const toggleDirectory = useCallback(
    (path: VZPath) => {
      // Create a copy of the currently open directories
      const updatedOpenDirectories = new Set(
        openDirectories,
      );

      // Check if the directory is currently open
      const directoryIsOpen = isDirectoryOpen(path);

      // Toggle the directory's state
      if (directoryIsOpen) {
        updatedOpenDirectories.delete(path);
      } else {
        updatedOpenDirectories.add(path);
      }

      // Update the state with the modified set of open directories
      setOpenDirectories(updatedOpenDirectories);
    },
    [openDirectories, isDirectoryOpen],
  );

  return { isDirectoryOpen, toggleDirectory };
};
