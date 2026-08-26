import {
  completeAddressListSnapshots,
  createAddressListCommitBatcher,
  createAddressListSnapshotHydrator,
  getAddressesWithoutListSnapshot,
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

  it('treats an empty in-memory list as a reusable snapshot', () => {
    expect(
      getAddressesWithoutListSnapshot(['0xA', '0xB', '0xC'], {
        '0xa': ['token'],
        '0xb': [],
      }),
    ).toEqual(['0xc']);
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

  it('guarantees a fresh read when a commit arrives during hydration', async () => {
    const stale = deferred<Record<string, string[]>>();
    const fresh = deferred<Record<string, string[]>>();
    const load = jest
      .fn<Promise<Record<string, string[]>>, [string[]]>()
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => fresh.promise);
    const apply = jest.fn();
    const hydrator = createAddressListSnapshotHydrator({ load, apply });

    const initialHydration = hydrator.hydrate(['0xA']);
    await Promise.resolve();
    const refresh = hydrator.refresh(['0xA']);
    stale.resolve({ '0xa': ['stale'] });
    await initialHydration;
    for (let flush = 0; flush < 5 && load.mock.calls.length < 2; flush += 1) {
      await Promise.resolve();
    }

    expect(load).toHaveBeenNthCalledWith(2, ['0xa']);
    expect(apply).not.toHaveBeenCalled();

    fresh.resolve({ '0xa': ['fresh'] });
    await refresh;
    expect(apply).toHaveBeenCalledWith({ '0xa': ['fresh'] }, ['0xa']);
  });

  it('batches a burst of committed addresses into one apply', async () => {
    jest.useFakeTimers();
    try {
      const applied = deferred<void>();
      const apply = jest.fn(() => applied.promise);
      const batcher = createAddressListCommitBatcher({ apply, delayMs: 10 });

      const first = batcher.enqueue(['0xA', '0xB']);
      const second = batcher.enqueue(['0xB', '0xC']);
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      expect(apply).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledWith(['0xa', '0xb', '0xc']);

      applied.resolve();
      await Promise.all([first, second]);
    } finally {
      jest.useRealTimers();
    }
  });
});
