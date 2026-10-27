import {
  useRef,
  useEffect,
  useContext,
  useState,
  useCallback,
} from 'react';
import { Form } from '../ui';
import { VZCodeContext } from '../VZCodeContext';
import { VizFileId } from '@vizhub/viz-types';
import { SearchFile } from '../../types';
import { EditorView } from 'codemirror';
import { CloseSVG, DirectoryArrowSVG } from '../Icons';
import { FileTypeIcon } from './FileTypeIcon';
import { editorCacheKey } from '../useEditorCache';

function jumpToPattern(
  editor: EditorView,
  pattern: string,
  line: number,
  index: number,
) {
  const position: number =
    editor.state.doc.line(line).from + index;

  editor.dispatch({
    selection: {
      anchor: position,
      head: position + pattern.length,
    },
    scrollIntoView: true,
    effects: EditorView.scrollIntoView(position, {
      y: 'center',
    }),
  });
}

function isResultElementWithinView(container, element) {
  const containerTop = container.scrollTop;
  const containerBottom =
    containerTop + container.clientHeight;

  const elementTop =
    element.offsetTop - container.offsetTop;
  const elementBottom = elementTop + element.clientHeight;

  return (
    elementTop >= containerTop + 100 &&
    elementBottom <= containerBottom - 100
  );
}

export const Search = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const {
    search,
    setSearch,
    activePaneId,
    setActiveFileId,
    setSearchResults,
    setSearchFileVisibility,
    setSearchLineVisibility,
    setSearchFocusedIndex,
    shareDBDoc,
    editorCache,
    openTab,
  } = useContext(VZCodeContext);
  const {
    pattern,
    results,
    focusedIndex,
    focusedChildIndex,
    focused,
  } = search;
  const inputRef = useRef(null);
  const files: [string, SearchFile][] = Object.entries(
    results,
  ).filter(([_, file]) => file.visibility !== 'closed');

  useEffect(() => {
    if (isMounted) {
      // Only conduct a search after fully mounting and entering a new non-empty pattern
      setIsSearching(pattern.trim().length >= 1);

      // Search about 2 seconds after entering a new pattern
      const delaySearch = setTimeout(() => {
        if (
          pattern.trim().length >= 1 &&
          inputRef.current
        ) {
          setSearchResults(shareDBDoc);
          setIsSearching(false);
        }
      }, 2000);

      return () => clearTimeout(delaySearch);
    } else {
      setIsMounted(true);
    }
  }, [pattern, isMounted, setSearchResults, shareDBDoc]);

  const flattenResult = useCallback(
    (fileId: string, file: SearchFile) => {
      setSearchFileVisibility(
        shareDBDoc,
        fileId,
        file.visibility === 'open' &&
          focusedChildIndex === null
          ? 'flattened'
          : 'open',
      );
    },
    [
      setSearchFileVisibility,
      shareDBDoc,
      focusedChildIndex,
    ],
  );

  const closeResult = useCallback(
    (fileId: VizFileId) => {
      setSearchFileVisibility(shareDBDoc, fileId, 'closed');
    },
    [setSearchFileVisibility, shareDBDoc],
  );

  const focusFileElement = useCallback(
    (fileId: VizFileId, index: number) => {
      setActiveFileId(fileId);
      setSearchFocusedIndex(index, null);
    },
    [setActiveFileId, setSearchFocusedIndex],
  );

  const handleKeyDown = (event) => {
    event.preventDefault();

    if (files.length === 0) {
      return;
    }

    const matchingLines: number =
      files[focusedIndex][1].matches.length;

    switch (event.key) {
      case 'Tab':
        // Focus the file heading
        setSearchFocusedIndex(focusedIndex, null);
        break;
      case 'ArrowUp':
        if (
          focusedIndex == 0 &&
          focusedChildIndex == null
        ) {
          // No effect on first search listing
          break;
        } else if (
          focusedChildIndex === null ||
          matchingLines == 0
        ) {
          // Toggle the previous file last child, if any
          const previousMatchingLines: number =
            files[focusedIndex - 1][1].matches.length;
          setSearchFocusedIndex(
            focusedIndex - 1,
            previousMatchingLines > 0
              ? previousMatchingLines - 1
              : null,
          );
        } else if (focusedChildIndex === 0) {
          // Toggle the file
          setSearchFocusedIndex(focusedIndex, null);
        } else {
          // Toggle the previous matching line
          setSearchFocusedIndex(
            focusedIndex,
            focusedChildIndex - 1,
          );
        }

        break;
      case 'ArrowDown':
        if (
          focusedIndex == files.length - 1 &&
          focusedChildIndex == matchingLines - 1
        ) {
          // Last matching line should have no effect
          break;
        } else if (
          focusedChildIndex === null &&
          matchingLines > 0
        ) {
          // Toggle the first matching line
          setSearchFocusedIndex(focusedIndex, 0);
        } else if (
          focusedChildIndex == matchingLines - 1 ||
          matchingLines == 0
        ) {
          // Toggle the next file
          setSearchFocusedIndex(focusedIndex + 1, null);
        } else {
          // Toggle the next matching line
          setSearchFocusedIndex(
            focusedIndex,
            focusedChildIndex + 1,
          );
        }

        break;
      case 'ArrowLeft':
        if (focusedChildIndex !== null) {
          setSearchFocusedIndex(focusedIndex, null);
        } else {
          flattenResult(
            files[focusedIndex][0],
            files[focusedIndex][1],
          );
        }
        break;
      case 'ArrowRight':
        if (files[focusedIndex][1].visibility !== 'open') {
          flattenResult(
            files[focusedIndex][0],
            files[focusedIndex][1],
          );
        } else if (
          focusedChildIndex === null &&
          matchingLines !== 0
        ) {
          setSearchFocusedIndex(focusedIndex, 0);
        }

        break;
      case 'Enter':
      case ' ':
        const fileId: VizFileId = files[focusedIndex][0];

        openTab({ fileId, isTransient: true });

        setActiveFileId(fileId);

        if (focusedChildIndex !== null) {
          // Jump to matching line
          const line: number =
            files[focusedIndex][1].matches[
              focusedChildIndex
            ].line;
          const index: number =
            files[focusedIndex][1].matches[
              focusedChildIndex
            ].index;

          const cacheKey = editorCacheKey(
            fileId,
            activePaneId,
          );
          if (editorCache.has(cacheKey)) {
            jumpToPattern(
              editorCache.get(cacheKey).editor,
              pattern,
              line,
              index,
            );
          }
        }
        break;
      default:
        break;
    }

    // Ensure keyboard navigation keeps results within the current view
    const file: string = files[focusedIndex][0];
    const container = document.getElementById(
      'sidebar-view-container',
    );

    if (container) {
      if (focusedChildIndex === null) {
        const fileElement = document.getElementById(file);

        if (
          !isResultElementWithinView(container, fileElement)
        ) {
          fileElement.scrollIntoView({ block: 'center' });
        }
      } else {
        const line =
          files[focusedIndex][1].matches[focusedChildIndex]
            .line;
        const lineElement = document.getElementById(
          file + '-' + line,
        );

        if (
          !isResultElementWithinView(container, lineElement)
        ) {
          lineElement.scrollIntoView({ block: 'center' });
        }
      }
    }
  };

  useEffect(() => {
    // Focus the search input on mount and keyboard shortcut invocation
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [focused]);

  return (
    <div>
      <Form.Group
        className="sidebar-search-form"
        controlId="searchName"
      >
        <Form.Control
          type="text"
          value={pattern}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          ref={inputRef}
          spellCheck="false"
        />
      </Form.Group>
      {Object.keys(results).length >= 1 &&
      pattern.trim().length >= 1 ? (
        <div
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="search-results"
        >
          {files.map(
            (
              [fileId, file]: [string, SearchFile],
              index,
            ) => {
              const matches = file.matches;
              return (
                <div
                  className="search-result"
                  key={file.name}
                >
                  <div
                    onClick={() =>
                      focusFileElement(fileId, index)
                    }
                    id={fileId}
                    className={`search-file-heading 
                      ${
                        focusedIndex == index &&
                        focusedChildIndex == null
                          ? 'active'
                          : ''
                      }`}
                  >
                    <div className="search-file-title">
                      <div
                        className="arrow-wrapper"
                        onClick={() =>
                          flattenResult(fileId, file)
                        }
                        style={{
                          transform: `rotate(${file.visibility === 'open' ? 90 : 0}deg)`,
                        }}
                      >
                        <DirectoryArrowSVG />
                      </div>
                      <div className="search-file-name">
                        <FileTypeIcon name={file.name} />
                        <h5>{file.name}</h5>
                      </div>
                    </div>
                    <div className="search-file-info">
                      {index == focusedIndex &&
                      focusedChildIndex == null ? (
                        <span
                          className="search-file-close"
                          onClick={(event) => {
                            event.stopPropagation();
                            closeResult(fileId);
                            // Focus the previous search file, if possible
                            setSearchFocusedIndex(
                              Math.max(0, index - 1),
                              null,
                            );
                          }}
                        >
                          <CloseSVG />
                        </span>
                      ) : (
                        <h6 className="search-file-count">
                          {matches.length}
                        </h6>
                      )}
                    </div>
                  </div>
                  <div className="search-file-lines">
                    {(file.visibility === 'open' ||
                      (file.visibility === 'flattened' &&
                        index == focusedIndex &&
                        focusedChildIndex !== null)) &&
                      file.matches.map(
                        (match, childIndex) => {
                          const before =
                            match.text.substring(
                              0,
                              match.index,
                            );
                          const hit = match.text.substring(
                            match.index,
                            match.index + pattern.length,
                          );
                          const after =
                            match.text.substring(
                              match.index + pattern.length,
                            );

                          const identifier =
                            file.name + '-' + match.line;

                          return (
                            <div
                              key={identifier}
                              tabIndex={
                                index == focusedIndex
                                  ? 0
                                  : -1
                              }
                              id={fileId + '-' + match.line}
                              className={`search-line 
                              ${
                                focusedIndex == index &&
                                focusedChildIndex ==
                                  childIndex
                                  ? 'active'
                                  : ''
                              }`}
                            >
                              <p
                                key={
                                  file.name +
                                  ' - ' +
                                  match.line +
                                  ' - ' +
                                  match.index
                                }
                                onClick={() => {
                                  setSearchFocusedIndex(
                                    index,
                                    childIndex,
                                  );

                                  openTab({
                                    fileId,
                                    isTransient: true,
                                  });

                                  setActiveFileId(fileId);

                                  const cacheKey =
                                    editorCacheKey(
                                      fileId,
                                      activePaneId,
                                    );

                                  if (
                                    editorCache.has(
                                      cacheKey,
                                    )
                                  ) {
                                    jumpToPattern(
                                      editorCache.get(
                                        cacheKey,
                                      ).editor,
                                      pattern,
                                      match.line,
                                      match.index,
                                    );
                                  }
                                }}
                              >
                                {before}
                                <span className="search-pattern">
                                  {hit}
                                </span>
                                {after}
                              </p>
                              {focusedIndex == index &&
                                focusedChildIndex ===
                                  childIndex && (
                                  <span
                                    className="search-file-close"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSearchLineVisibility(
                                        shareDBDoc,
                                        fileId,
                                        match.line,
                                      );

                                      if (childIndex == 0) {
                                        // Removing remaining single line
                                        setSearchFocusedIndex(
                                          index,
                                          null,
                                        );
                                      }
                                    }}
                                  >
                                    <CloseSVG />
                                  </span>
                                )}
                            </div>
                          );
                        },
                      )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      ) : (
        <div className="search-state">
          <h6>
            {isSearching ? 'Searching...' : 'No Results'}
          </h6>
        </div>
      )}
    </div>
  );
};
