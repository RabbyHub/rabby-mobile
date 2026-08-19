import {
  BoundedConcurrencySkippedError,
  mapSettledWithConcurrency,
  mapWithConcurrency,
} from './boundedConcurrency';

describe('boundedConcurrency', () => {
  it('preserves input order while bounding active work', async () => {
    let activeCount = 0;
    let maximumActiveCount = 0;

    const values = await mapWithConcurrency(
      [30, 5, 20, 1, 10],
      2,
      async (delayMs, index) => {
        activeCount += 1;
        maximumActiveCount = Math.max(maximumActiveCount, activeCount);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        activeCount -= 1;
        return index;
      },
    );

    expect(values).toEqual([0, 1, 2, 3, 4]);
    expect(maximumActiveCount).toBe(2);
  });

  it('settles every item without opening another worker slot', async () => {
    let activeCount = 0;
    let maximumActiveCount = 0;

    const results = await mapSettledWithConcurrency(
      [0, 1, 2, 3],
      2,
      async value => {
        activeCount += 1;
        maximumActiveCount = Math.max(maximumActiveCount, activeCount);
        await Promise.resolve();
        activeCount -= 1;
        if (value === 1) {
          throw new Error('expected failure');
        }
        return value * 2;
      },
    );

    expect(results.map(result => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
    ]);
    expect(maximumActiveCount).toBe(2);
  });

  it('stops taking new work after a terminal error while settling active work', async () => {
    const started: number[] = [];
    const terminalError = new Error('HTTP 429');

    const results = await mapSettledWithConcurrency(
      [0, 1, 2, 3, 4, 5],
      2,
      async value => {
        started.push(value);
        if (value === 1) {
          throw terminalError;
        }
        await Promise.resolve();
        return value;
      },
      { stopOnError: reason => reason === terminalError },
    );

    expect(started).toEqual([0, 1]);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 0 });
    expect(results[1]).toEqual({ status: 'rejected', reason: terminalError });
    expect(
      results
        .slice(2)
        .every(
          result =>
            result.status === 'rejected' &&
            result.reason instanceof BoundedConcurrencySkippedError &&
            result.reason.stopReason === terminalError,
        ),
    ).toBe(true);
  });
});
