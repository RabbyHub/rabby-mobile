import { useState, useEffect, useRef } from 'react';

export function useDebouncedValue<T>(value: T, delay: number = 1000): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function resolvePausedDebouncedValue<T>(
  committedValue: T,
  value: T,
  wasPaused: boolean,
  paused: boolean,
) {
  const shouldCommitImmediately = wasPaused && !paused;

  return {
    displayedValue: shouldCommitImmediately ? value : committedValue,
    shouldCommitImmediately,
  };
}

export function usePausedDebouncedValue<T>(
  value: T,
  paused: boolean,
  delay: number = 1000,
): T {
  const [committedValue, setCommittedValue] = useState<T>(value);
  const previousPausedRef = useRef(paused);
  const { displayedValue, shouldCommitImmediately } =
    resolvePausedDebouncedValue(
      committedValue,
      value,
      previousPausedRef.current,
      paused,
    );

  useEffect(() => {
    previousPausedRef.current = paused;

    if (paused) {
      return;
    }

    if (shouldCommitImmediately) {
      setCommittedValue(value);
      return;
    }

    const handler = setTimeout(() => {
      setCommittedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [delay, paused, shouldCommitImmediately, value]);

  return displayedValue;
}

export function useThrottledValueLeading<T>(value: T, delay: number = 1000): T {
  const [throttled, setThrottled] = useState(value);
  const lastTriggered = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastTriggered.current >= delay) {
      setThrottled(value);
      lastTriggered.current = now;
    }
  }, [value, delay]);

  return throttled;
}

export function useThrottledValueTrailing<T>(
  value: T,
  delay: number = 1000,
): T {
  const [throttled, setThrottled] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setThrottled(value);
      timeoutRef.current = null;
    }, delay);

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay]);

  return throttled;
}
