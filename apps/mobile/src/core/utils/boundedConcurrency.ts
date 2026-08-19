export const ASSET_REMOTE_ADDRESS_CONCURRENCY = 4;

type SettledConcurrencyOptions = Readonly<{
  stopOnError?: (reason: unknown) => boolean;
}>;

export class BoundedConcurrencySkippedError extends Error {
  readonly stopReason: unknown;

  constructor(stopReason: unknown) {
    super('Task skipped because bounded concurrency stopped early');
    this.name = 'BoundedConcurrencySkippedError';
    this.stopReason = stopReason;
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) {
    return [];
  }

  const workerCount = Math.max(
    1,
    Math.min(items.length, Math.floor(concurrency) || 1),
  );
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    }),
  );

  return results;
}

export function mapSettledWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  options: SettledConcurrencyOptions = {},
): Promise<PromiseSettledResult<R>[]> {
  if (!items.length) {
    return Promise.resolve([]);
  }

  const workerCount = Math.max(
    1,
    Math.min(items.length, Math.floor(concurrency) || 1),
  );
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;
  let stopped = false;
  let stopReason: unknown;

  return Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (!stopped && nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          results[index] = {
            status: 'fulfilled',
            value: await mapper(items[index], index),
          };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
          if (options.stopOnError?.(reason)) {
            stopped = true;
            stopReason = reason;
          }
        }
      }
    }),
  ).then(() => {
    if (stopped) {
      for (let index = 0; index < results.length; index += 1) {
        if (!results[index]) {
          results[index] = {
            status: 'rejected',
            reason: new BoundedConcurrencySkippedError(stopReason),
          };
        }
      }
    }
    return results;
  });
}
