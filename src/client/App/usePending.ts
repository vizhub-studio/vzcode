import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { ShareDBDoc } from '../../types';
import { VizContent } from '@vizhub/viz-types';

// import { runDelay } from '../constants';
// TODO understand what this part is for
const runDelay = 1000;

export const usePending = (
  shareDBDoc: ShareDBDoc<VizContent>,
) => {
  const lastOpTimerRef = useRef<NodeJS.Timeout | undefined>(
    undefined,
  );

  // TODO rename this to isPending,
  // and also rename connected to isConnected.
  const [pending, setPending] = useState<boolean>(false);

  const resetOnNoPending = useCallback(() => {
    if (!shareDBDoc) return;

    // This happens AFTER the changes have been
    // acknowledged by the server.
    shareDBDoc.whenNothingPending(() => {
      setPending(false);
    });
  }, [shareDBDoc, setPending]);

  useEffect(() => {
    if (!shareDBDoc) return;

    // This happens when you type, but BEFORE
    // the changes are sent to the server.
    shareDBDoc.on('before op', () => {
      setPending(true);

      clearTimeout(lastOpTimerRef.current);

      lastOpTimerRef.current = setTimeout(() => {
        // should be triggered only once, cause upcoming ops unschedule previous resetOnNoPending
        resetOnNoPending();
      }, runDelay);
    });
  }, [shareDBDoc, resetOnNoPending]);

  return pending;
};
