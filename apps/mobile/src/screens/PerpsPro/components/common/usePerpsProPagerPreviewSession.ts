import { useCallback, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';

type UsePerpsProPagerPreviewSessionParams<Preview> = {
  gestureSessionId: SharedValue<number>;
  isGestureActive: SharedValue<boolean>;
  onPreview: (preview: Preview | null) => void;
};

/**
 * Guards the JS consumer of UI-thread pager previews.
 *
 * Closing the UI shared flag prevents future scroll events, while the session
 * check also rejects runOnJS callbacks that were queued before the pager
 * settled but execute afterwards.
 */
export const usePerpsProPagerPreviewSession = <Preview>({
  gestureSessionId,
  isGestureActive,
  onPreview,
}: UsePerpsProPagerPreviewSessionParams<Preview>) => {
  const activeSessionIdRef = useRef<number | null>(null);
  const closedThroughSessionIdRef = useRef(0);

  const beginPreviewSession = useCallback(
    (sessionId: number) => {
      if (
        sessionId <= closedThroughSessionIdRef.current ||
        gestureSessionId.value !== sessionId ||
        !isGestureActive.value
      ) {
        return;
      }
      activeSessionIdRef.current = sessionId;
    },
    [gestureSessionId, isGestureActive],
  );

  const publishPreview = useCallback(
    (sessionId: number, preview: Preview) => {
      if (
        sessionId <= closedThroughSessionIdRef.current ||
        activeSessionIdRef.current !== sessionId ||
        gestureSessionId.value !== sessionId ||
        !isGestureActive.value
      ) {
        return;
      }
      onPreview(preview);
    },
    [gestureSessionId, isGestureActive, onPreview],
  );

  const finishPreviewSession = useCallback(
    (sessionId: number, clearPreview: boolean) => {
      closedThroughSessionIdRef.current = Math.max(
        closedThroughSessionIdRef.current,
        sessionId,
      );
      if (activeSessionIdRef.current === sessionId) {
        activeSessionIdRef.current = null;
      }
      if (
        clearPreview &&
        gestureSessionId.value === sessionId &&
        !isGestureActive.value
      ) {
        onPreview(null);
      }
    },
    [gestureSessionId, isGestureActive, onPreview],
  );

  const resetPreviewSession = useCallback(
    (clearPreview = true) => {
      const sessionId = gestureSessionId.value;
      closedThroughSessionIdRef.current = Math.max(
        closedThroughSessionIdRef.current,
        sessionId,
      );
      activeSessionIdRef.current = null;
      isGestureActive.value = false;
      if (clearPreview) {
        onPreview(null);
      }
    },
    [gestureSessionId, isGestureActive, onPreview],
  );

  return {
    beginPreviewSession,
    finishPreviewSession,
    publishPreview,
    resetPreviewSession,
  };
};
