import {
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { PlaySVG } from '../Icons';
import { SplitEditorSVG } from '../Icons/SplitEditorSVG';
import { VZCodeContext } from '../VZCodeContext';
import { OverlayTrigger, Tooltip } from '../ui';

import './style.scss';

// Feature flag for split pane feature (WIP)
const enableSplitPane = false;

export const RunCodeWidget = ({
  runCodeWidgetTooltipText = (
    <>
      <strong>Run Code</strong>
      <div>(Shift + Enter or Ctrl + s)</div>
    </>
  ),
}: {
  runCodeWidgetTooltipText?: JSX.Element;
}) => {
  const { runCodeRef, runPrettierRef, splitCurrentPane } =
    useContext(VZCodeContext);
  const [isRunning, setIsRunning] = useState(false);

  const handleClick = useCallback(
    (_event?: React.MouseEvent) => {
      setIsRunning(true); // Set the running state to true

      // Run Prettier
      const runPrettier = runPrettierRef.current;
      if (runPrettier !== null) {
        runPrettier();
      }

      // Run the code
      const runCode = runCodeRef.current;
      if (runCode !== null) {
        runCode();
      }

      // Optional: reset the icon state after animation completes (e.g., 1 second)
      setTimeout(() => setIsRunning(false), 1000);
    },
    [runCodeRef, runPrettierRef],
  );

  const handleSplitEditor = useCallback(() => {
    splitCurrentPane();
  }, [splitCurrentPane]);

  // Add the keyboard event listener for Ctrl+S and Shift+Enter
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey && event.key === 's') ||
        (event.shiftKey && event.key === 'Enter')
      ) {
        event.preventDefault();
        handleClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClick]);

  return (
    <div>
      <div className="vz-code-split-view-widget">
        {enableSplitPane && (
          <OverlayTrigger
            placement="bottom"
            overlay={
              <Tooltip id="fork-file-tooltip">
                Split Editor
              </Tooltip>
            }
          >
            <i
              onClick={handleSplitEditor}
              className="icon-button icon-button-dark"
            >
              <SplitEditorSVG />
            </i>
          </OverlayTrigger>
        )}
      </div>
      <div className="vz-code-run-code-widget">
        <OverlayTrigger
          placement="bottom"
          overlay={
            <Tooltip id="run-code-widget-tooltip">
              {runCodeWidgetTooltipText}
            </Tooltip>
          }
        >
          <i
            className={`icon-button icon-button-dark ${isRunning ? 'rotate-icon' : ''}`}
            onClick={handleClick}
          >
            <PlaySVG />
          </i>
        </OverlayTrigger>
      </div>
    </div>
  );
};
