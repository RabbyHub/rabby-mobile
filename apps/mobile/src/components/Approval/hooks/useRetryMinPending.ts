import { useCallback, useEffect, useRef } from 'react';

// A retry that fails at once flips straight back to the same error, so the
// user cannot tell it ran. Keep the in-progress state visible for a moment.
export const RETRY_MIN_PENDING_MS = 600;

export function useRetryMinPending(minMs = RETRY_MIN_PENDING_MS) {
  const retryStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const markRetryStarted = useCallback(() => {
    // A new attempt supersedes a failure still waiting to be shown.
    clearTimeout(timerRef.current);
    retryStartedAtRef.current = Date.now();
  }, []);

  const afterMinPending = useCallback(
    (show: () => void) => {
      const startedAt = retryStartedAtRef.current;
      retryStartedAtRef.current = null;
      const wait = startedAt === null ? 0 : minMs - (Date.now() - startedAt);
      if (wait <= 0) {
        show();
        return;
      }
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(show, wait);
    },
    [minMs],
  );

  return { markRetryStarted, afterMinPending };
}
