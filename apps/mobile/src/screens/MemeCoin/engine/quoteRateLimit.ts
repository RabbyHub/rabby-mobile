type Clock = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/** A quote request the backend answered with 429; executor does not auto retry it. */
export class QuoteRateLimitedError extends Error {
  constructor() {
    super('quote rate limited');
    this.name = 'QuoteRateLimitedError';
  }
}

export const isTooManyRequests = (error: unknown) =>
  (error as { response?: { status?: number } } | null | undefined)?.response
    ?.status === 429;

/** Starts at most `limit` tasks in any `windowMs`, in the order they were scheduled. */
export const createRateLimiter = ({
  limit,
  windowMs,
  now = Date.now,
  sleep = defaultSleep,
}: { limit: number; windowMs: number } & Clock) => {
  const startedAt: number[] = [];
  let queue = Promise.resolve();

  const takeSlot = async () => {
    for (;;) {
      const time = now();
      while (startedAt.length && time - startedAt[0] >= windowMs) {
        startedAt.shift();
      }
      if (startedAt.length < limit) {
        startedAt.push(time);
        return;
      }
      await sleep(startedAt[0] + windowMs - time);
    }
  };

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      const turn = queue.then(takeSlot);
      queue = turn;
      return turn.then(task);
    },
  };
};

/** Waits baseMs, then twice as long after each further 429 in a row (up to maxMs), counted from the last 429. */
export const createRateLimitBackoff = ({
  baseMs,
  maxMs,
  now = Date.now,
  sleep = defaultSleep,
}: { baseMs: number; maxMs: number } & Clock) => {
  let strikes = 0;
  let lastHitAt = 0;
  return {
    async wait() {
      if (!strikes) {
        return;
      }
      const delay = Math.min(baseMs * 2 ** (strikes - 1), maxMs);
      const left = lastHitAt + delay - now();
      if (left > 0) {
        await sleep(left);
      }
    },
    onRateLimited() {
      strikes += 1;
      lastHitAt = now();
    },
    onSuccess() {
      strikes = 0;
    },
  };
};
