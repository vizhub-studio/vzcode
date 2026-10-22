import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  parseUnifiedDiffStats,
  combineUnifiedDiffs,
  isFileDeletion,
  getDeletedFileName,
} from '../../utils/fileDiff';
import * as Diff2Html from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import './DiffView.scss';
import {
  scrollToFirstDiff,
  getHeaderOffset,
  announceDiffSummary,
} from '../utils/scrollUtils';
import type { DiffViewProps } from '../props';

// Methods that can be called on DiffView from parent components
export interface DiffViewRef {
  scrollToFirstHunk: () => void;
  focusDiffContainer: () => void;
  announceSummary: () => void;
  getFirstHunkElement: () => HTMLElement | null;
}

export const DiffView = forwardRef<
  DiffViewRef,
  DiffViewProps
>(({ diffData, onOpenFile }, ref) => {
  const diffContainerRef = useRef<HTMLDivElement>(null);

  const allDiffs = Object.values(diffData).filter(
    (diff) => diff.length > 0,
  );

  // Separate deleted files from regular diffs
  const deletedFiles: string[] = [];
  const regularDiffs: string[] = [];

  for (const diff of allDiffs) {
    if (isFileDeletion(diff)) {
      deletedFiles.push(diff);
    } else {
      regularDiffs.push(diff);
    }
  }

  // Calculate statistics from regular unified diffs only
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const unifiedDiff of regularDiffs) {
    const stats = parseUnifiedDiffStats(unifiedDiff);
    totalAdditions += stats.additions;
    totalDeletions += stats.deletions;
  }

  // Combine regular unified diffs and convert to HTML using diff2html
  const combinedUnifiedDiff = combineUnifiedDiffs(diffData);
  const diffHtml = Diff2Html.html(combinedUnifiedDiff, {
    drawFileList: false,
    matching: 'words',
    diffStyle: 'word',
    outputFormat: 'line-by-line',
  });

  // Expose methods for parent components to control scrolling and focus
  useImperativeHandle(
    ref,
    () => ({
      scrollToFirstHunk: () => {
        if (diffContainerRef.current) {
          const headerOffset = getHeaderOffset();
          scrollToFirstDiff(
            diffContainerRef.current,
            headerOffset,
          );
        }
      },
      focusDiffContainer: () => {
        if (diffContainerRef.current) {
          diffContainerRef.current.tabIndex = -1;
          diffContainerRef.current.focus();
        }
      },
      announceSummary: () => {
        if (diffContainerRef.current) {
          announceDiffSummary(diffContainerRef.current);
        }
      },
      getFirstHunkElement: () => {
        if (diffContainerRef.current) {
          return diffContainerRef.current.querySelector(
            '.d2h-diff-tbody tr',
          );
        }
        return null;
      },
    }),
    [],
  );

  // Add click handlers to file names after HTML is rendered
  useEffect(() => {
    if (!diffContainerRef.current) return;

    const handleFileNameClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('d2h-file-name')) {
        event.preventDefault();
        event.stopPropagation();

        const fileName = target.textContent?.trim();

        if (fileName && onOpenFile) {
          onOpenFile(fileName);
        }
      }
    };

    const container = diffContainerRef.current;
    const fileNameElements = container.querySelectorAll(
      '.d2h-file-name',
    );

    // Add click event listeners and cursor pointer style
    fileNameElements.forEach((element) => {
      element.addEventListener(
        'click',
        handleFileNameClick,
      );
      (element as HTMLElement).style.cursor = 'pointer';
      (element as HTMLElement).style.textDecoration =
        'underline';
      (element as HTMLElement).style.color = '#58a6ff'; // GitHub blue link color
    });

    return () => {
      // Cleanup event listeners
      fileNameElements.forEach((element) => {
        element.removeEventListener(
          'click',
          handleFileNameClick,
        );
      });
    };
  }, [diffHtml, onOpenFile]);

  if (allDiffs.length === 0) {
    return null;
  }

  return (
    <div className="diff-view">
      <div className="diff-summary" id="diff-summary">
        <div className="diff-stats">
          <span className="files-changed">
            {allDiffs.length} file
            {allDiffs.length !== 1 ? 's' : ''} changed
          </span>
          {totalAdditions > 0 && (
            <span className="additions">
              +{totalAdditions}
            </span>
          )}
          {totalDeletions > 0 && (
            <span className="deletions">
              -{totalDeletions}
            </span>
          )}
          {deletedFiles.length > 0 && (
            <span className="deletions">
              {deletedFiles.length} deleted
            </span>
          )}
        </div>
      </div>

      {/* Render deleted files */}
      {deletedFiles.map((deletionMarker, index) => {
        const fileName = getDeletedFileName(deletionMarker);
        return (
          <div key={index} className="deleted-file">
            <div className="deleted-file-header">
              <span className="deleted-file-name">
                {fileName}
              </span>
              <span className="deleted-file-status">
                File deleted
              </span>
            </div>
          </div>
        );
      })}

      {/* Render regular diffs */}
      {regularDiffs.length > 0 && (
        <div
          className="diff-files"
          ref={diffContainerRef}
          tabIndex={-1}
          role="region"
          aria-label="Code diff content"
          aria-describedby="diff-summary"
          dangerouslySetInnerHTML={{ __html: diffHtml }}
        />
      )}
    </div>
  );
});

// Add display name for debugging
DiffView.displayName = 'DiffView';
