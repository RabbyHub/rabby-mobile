import { useEffect } from 'react';

const every10sListeners = new Set<() => void>();
let every10sTimer: ReturnType<typeof setTimeout> | null = null;
let every10sLastRun = 0;
let every10sStarted = false;

const scheduleEvery10sNext = () => {
  if (every10sTimer) {
    clearTimeout(every10sTimer);
    every10sTimer = null;
  }

  const delay = 10000;

  every10sTimer = setTimeout(() => {
    const now = Date.now();
    if (now - every10sLastRun >= 10000) {
      if (every10sListeners.size > 0) {
        Array.from(every10sListeners).forEach(fn => {
          try {
            fn();
          } catch (e) {
            console.error(e);
          }
        });
      }
      every10sLastRun = now;
    }
    scheduleEvery10sNext();
  }, delay);
};

const startEvery10sEvent = () => {
  if (every10sStarted) {
    return;
  }
  every10sStarted = true;
  scheduleEvery10sNext();
};

export const every10sEvent = {
  on(listener: () => void) {
    every10sListeners.add(listener);
    return () => {
      every10sListeners.delete(listener);
    };
  },
  off(listener: () => void) {
    every10sListeners.delete(listener);
  },
  clear() {
    every10sListeners.clear();
  },
} as const;

export const useEvery10sEvent = () => {
  useEffect(() => {
    startEvery10sEvent();
    return () => {
      every10sEvent.clear();
      every10sStarted = false;
      every10sLastRun = 0;
      if (every10sTimer) {
        clearTimeout(every10sTimer);
        every10sTimer = null;
      }
    };
  }, []);

  return every10sEvent;
};
