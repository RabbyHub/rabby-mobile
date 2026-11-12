const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/** Starts at most `limit` tasks in any `windowMs`, in the order they were scheduled. */
export const createRateLimiter = ({
  limit,
  windowMs,
  now = Date.now,
  sleep = defaultSleep,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}) => {
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
