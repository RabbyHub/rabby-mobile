export class ExecutionStoppedError extends Error {
  constructor() {
    super('MemeTradeExecutionStopped');
    this.name = 'ExecutionStoppedError';
  }
}

export type PauseGate = {
  pause(): void;
  resume(): void;
  stop(): void;
  isPaused(): boolean;
  isStopped(): boolean;
  /** Resolves at once while running, waits while paused, rejects once stopped. */
  wait(): Promise<void>;
};

export const createPauseGate = (): PauseGate => {
  let paused = false;
  let stopped = false;
  let waiters: { resolve: () => void; reject: (error: Error) => void }[] = [];

  const flush = () => {
    const current = waiters;
    waiters = [];
    current.forEach(w =>
      stopped ? w.reject(new ExecutionStoppedError()) : w.resolve(),
    );
  };

  return {
    pause() {
      if (!stopped) {
        paused = true;
      }
    },
    resume() {
      if (stopped) {
        return;
      }
      paused = false;
      flush();
    },
    stop() {
      stopped = true;
      paused = false;
      flush();
    },
    isPaused: () => paused,
    isStopped: () => stopped,
    wait() {
      if (stopped) {
        return Promise.reject(new ExecutionStoppedError());
      }
      if (!paused) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        waiters.push({ resolve, reject });
      });
    },
  };
};
