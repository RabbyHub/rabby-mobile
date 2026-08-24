import {
  completeAddressListSnapshots,
  createAddressListCommitBatcher,
  createAddressListSnapshotHydrator,
  mergeAddressListSnapshots,
} from './_addressListSnapshot';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('address list snapshots', () => {
  it('normalizes addresses and represents an empty result as a valid snapshot', () => {
    expect(
      completeAddressListSnapshots(['0xABC', '0xabc', '0xDEF'], {
        '0xabc': ['token'],
      }),
    ).toEqual({
      '0xabc': ['token'],
      '0xdef': [],
    });
  });

  it('updates only requested addresses and preserves reusable snapshots', () => {
    expect(
      mergeAddressListSnapshots(
        {
          '0xsingle': ['single'],
          '0xmulti': ['old'],
        },
        ['0xMULTI', '0xempty'],
        {
          '0xmulti': ['new'],
        },
      ),
    ).toEqual({
      '0xsingle': ['single'],
      '0xmulti': ['new'],
      '0xempty': [],
    });
  });

  it('deduplicates overlapping address hydrations', async () => {
    const first = deferred<Record<string, string[]>>();
    const second = deferred<Record<string, string[]>>();
    const load = jest
      .fn<Promise<Record<string, string[]>>, [string[]]>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const apply = jest.fn();
    const hydrator = createAddressListSnapshotHydrator({ load, apply });

    const firstHydrate = hydrator.hydrate(['0xA', '0xB']);
    await Promise.resolve();
    const secondHydrate = hydrator.hydrate(['0xB', '0xC']);
    await Promise.resolve();

    expect(load).toHaveBeenNthCalledWith(1, ['0xa', '0xb']);
    expect(load).toHaveBeenNthCalledWith(2, ['0xc']);

    first.resolve({ '0xa': ['a'], '0xb': ['b'] });
    second.resolve({ '0xc': ['c'] });
    await Promise.all([firstHydrate, secondHydrate]);

    expect(apply).toHaveBeenCalledTimes(2);
  });

  it('does not let a late DB snapshot overwrite a newer value', async () => {
    const pending = deferred<Record<string, string[]>>();
    const apply = jest.fn();
    const hydrator = createAddressListSnapshotHydrator({
      load: () => pending.promise,
      apply,
    });

    const hydration = hydrator.hydrate(['0xA', '0xB']);
    await Promise.resolve();
    hydrator.invalidate(['0xA']);
    pending.resolve({
      '0xa': ['stale-a'],
      '0xb': ['cached-b'],
    });
    await hydration;

    expect(apply).toHaveBeenCalledWith({ '0xb': ['cached-b'] }, ['0xb']);
  });

  it('refreshes again after an invalidated in-flight hydration settles', async () => {
    const stale = deferred<Record<string, string[]>>();
    const fresh = deferred<Record<string, string[]>>();
    const load = jest
      .fn<Promise<Record<string, string[]>>, [string[]]>()
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => fresh.promise);
    const apply = jest.fn();
    const hydrator = createAddressListSnapshotHydrator({ load, apply });

    const staleHydration = hydrator.hydrate(['0xA']);
    await Promise.resolve();
    const refresh = hydrator.refresh(['0xA']);
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
    stale.resolve({ '0xa': ['stale'] });
    await staleHydration;
    for (let index = 0; index < 4 && load.mock.calls.length < 2; index += 1) {
      await Promise.resolve();
    }

    expect(load).toHaveBeenNthCalledWith(2, ['0xa']);
    expect(apply).not.toHaveBeenCalled();
    fresh.resolve({ '0xa': ['fresh'] });
    await refresh;

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ '0xa': ['fresh'] }, ['0xa']);
  });

  it('publishes a burst of native address commits as one normalized batch', async () => {
    jest.useFakeTimers();
    const apply = jest.fn().mockResolvedValue(undefined);
    const batcher = createAddressListCommitBatcher({ apply, delayMs: 8 });

    const first = batcher.enqueue(['0xA', '0xB']);
    const second = batcher.enqueue(['0xb', '0xC']);
    await jest.advanceTimersByTimeAsync(8);
    await Promise.all([first, second]);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(['0xa', '0xb', '0xc']);
    jest.useRealTimers();
  });

  it('rejects every waiter when a native commit batch cannot be published', async () => {
    jest.useFakeTimers();
    const error = new Error('database unavailable');
    const batcher = createAddressListCommitBatcher({
      apply: jest.fn().mockRejectedValue(error),
      delayMs: 1,
    });

    const first = batcher.enqueue(['0xA']);
    const second = batcher.enqueue(['0xB']);
    const firstResult = expect(first).rejects.toBe(error);
    const secondResult = expect(second).rejects.toBe(error);
    await jest.advanceTimersByTimeAsync(1);

    await firstResult;
    await secondResult;
    jest.useRealTimers();
  });

  it('holds a long-running address burst and publishes it once on finish', async () => {
    jest.useFakeTimers();
    const apply = jest.fn().mockResolvedValue(undefined);
    const batcher = createAddressListCommitBatcher({ apply, delayMs: 8 });
    const batch = batcher.beginBatch();

    await batcher.enqueue(['0xA']);
    await jest.advanceTimersByTimeAsync(80);
    await batcher.enqueue(['0xB', '0xC']);

    expect(apply).not.toHaveBeenCalled();
    await batch.finish();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(['0xa', '0xb', '0xc']);
    jest.useRealTimers();
  });

  it('propagates a held batch failure from finish', async () => {
    const error = new Error('projection failed');
    const batcher = createAddressListCommitBatcher({
      apply: jest.fn().mockRejectedValue(error),
    });
    const batch = batcher.beginBatch();

    await batcher.enqueue(['0xA']);

    await expect(batch.finish()).rejects.toBe(error);
  });
});
