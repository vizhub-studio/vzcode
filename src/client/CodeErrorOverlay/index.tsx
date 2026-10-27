import { useState, useCallback, useEffect } from 'react';
import { VizContent } from '@vizhub/viz-types';
import { CloseSVG } from '../Icons';
import './style.scss';

const enableErrorDismiss = true;

export const CodeErrorOverlay = ({
  errorMessage,
  content: _content,
}: {
  errorMessage: string | null;
  content: VizContent;
}) => {
  // console.log(
  //   'errorMessage in CodeErrorOverlay: ',
  //   errorMessage,
  // );
  const [isOverlayVisible, setIsOverlayVisible] =
    useState(true);

  // If errorMessage changes, set the overlay to be visible
  useEffect(() => {
    if (errorMessage !== null) {
      setIsOverlayVisible(true);
    }
  }, [errorMessage]);

  // If the content changes, set the overlay to be not visible.
  // Removed because it was interfering in the case of
  // server-side build errors on page load.
  // useEffect(() => {
  //   setIsOverlayVisible(false);
  // }, [content]);

  // Set the visibility state to false when the button is clicked
  const handleCloseClick = useCallback(() => {
    setIsOverlayVisible(false);
  }, []);

  // If the user presses the escape key, close the overlay.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseClick();
      }
    };
    document.addEventListener(
      'keydown',
      handleKeyDown,
      true,
    );

    // Remove the event listener when the component unmounts
    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
        true,
      );
    };
  }, [handleCloseClick]);

  return isOverlayVisible && errorMessage !== null ? (
    <div className="vz-code-error-overlay">
      <pre>{errorMessage}</pre>
      {enableErrorDismiss ? (
        <i
          className="vz-icon-button error-dismiss-button"
          onClick={handleCloseClick}
        >
          <CloseSVG />
        </i>
      ) : null}
    </div>
  ) : null;
};
