import {
  createPerpsRootModeAdapter,
  type PerpsRootModePreferenceSource,
} from './perpsRootModeAdapter';
import type { PerpsViewMode } from '@/core/services/perpsService';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function drain() {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

function fixture(viewMode: PerpsViewMode = 'simple', activate = true) {
  let preference: ReturnType<PerpsRootModePreferenceSource['getSnapshot']> = {
    viewMode,
    savingMode: null,
  };
  const listeners = new Set<() => void>();
  function publish(next: typeof preference) {
    preference = next;
    listeners.forEach(listener => listener());
  }
  const writes: ReturnType<typeof deferred<boolean>>[] = [];
  const source: PerpsRootModePreferenceSource = {
    getSnapshot: () => preference,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setViewMode: jest.fn((mode: PerpsViewMode) => {
      const write = deferred<boolean>();
      writes.push(write);
      publish({ ...preference, savingMode: mode });
      return write.promise.then(
        success => {
          publish({
            viewMode: success ? mode : preference.viewMode,
            savingMode: null,
          });
          return success;
        },
        error => {
          publish({ ...preference, savingMode: null });
          throw error;
        },
      );
    }),
  };
  const adapter = createPerpsRootModeAdapter(source);
  if (activate) {
    adapter.setActive(true);
  }
  return { adapter, source, writes, publish, listeners };
}

describe('Perps root mode adapter', () => {
  it('initializes from hydrated Pro without subscribing during construction', () => {
    const { adapter, source, listeners } = fixture('pro', false);
    expect(adapter.getSnapshot()).toEqual({
      requestedKey: 'pro',
      settledMode: 'pro',
    });
    expect(source.setViewMode).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
    adapter.setActive(true);
    expect(listeners.size).toBe(1);
    adapter.setActive(false);
    expect(listeners.size).toBe(0);
  });

  it.each([
    ['simple', 'pro'],
    ['pro', 'simple'],
  ] as const)(
    'publishes %s to %s immediately and saves only settlement',
    async (from, to) => {
      const { adapter, source, writes } = fixture(from);
      const updates = jest.fn();
      adapter.subscribe(updates);
      adapter.requestMode(to);
      expect(adapter.getSnapshot()).toEqual({
        requestedKey: to,
        settledMode: from,
      });
      await drain();
      expect(source.setViewMode).not.toHaveBeenCalled();
      adapter.onSettled(to);
      const settled = adapter.getSnapshot();
      expect(settled).toEqual({ requestedKey: to, settledMode: to });
      expect(updates).toHaveBeenCalledTimes(2);
      await drain();
      expect(source.setViewMode).toHaveBeenCalledWith(to);
      expect(adapter.getSnapshot()).toBe(settled);
      writes[0].resolve(true);
      await drain();
      expect(adapter.getSnapshot()).toBe(settled);
      expect(updates).toHaveBeenCalledTimes(2);
    },
  );

  it('does not save a cancelled preview, invalid key, or duplicate settlement', async () => {
    const { adapter, source } = fixture();
    const before = adapter.getSnapshot();
    adapter.onSettled('simple');
    adapter.onSettled('unknown');
    await drain();
    expect(adapter.getSnapshot()).toBe(before);
    expect(source.setViewMode).not.toHaveBeenCalled();
  });

  it.each([false, 'reject'] as const)(
    'does not rollback or retry a %s save',
    async failure => {
      const { adapter, source, writes } = fixture();
      adapter.onSettled('pro');
      const settled = adapter.getSnapshot();
      await drain();
      if (failure === 'reject') {
        writes[0].reject(new Error('save failed'));
      } else {
        writes[0].resolve(false);
      }
      await drain();
      adapter.onSettled('pro');
      await drain();
      expect(adapter.getSnapshot()).toBe(settled);
      expect(source.setViewMode).toHaveBeenCalledTimes(1);
      // Only a new explicit action retries; duplicate native completion does not.
      adapter.requestMode('pro');
      await drain();
      expect(source.setViewMode).toHaveBeenCalledTimes(2);
      writes[1].resolve(true);
      await drain();
      expect(adapter.getSnapshot()).toBe(settled);
    },
  );

  it('handles synchronous source failure without retrying or losing UI selection', async () => {
    const { adapter, source } = fixture();
    jest.mocked(source.setViewMode).mockImplementation(() => {
      throw new Error('write failed synchronously');
    });
    adapter.onSettled('pro');
    await drain();
    expect(source.setViewMode).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot()).toEqual({
      requestedKey: 'pro',
      settledMode: 'pro',
    });
  });

  it.each([
    ['simple', 'pro'],
    ['pro', 'simple'],
  ] as const)(
    'allows an immediate pending reverse from %s via %s',
    async (from, to) => {
      const { adapter, source, writes } = fixture(from);
      adapter.onSettled(to);
      await drain();
      adapter.requestMode(from);
      expect(adapter.getSnapshot()).toEqual({
        requestedKey: from,
        settledMode: to,
      });
      adapter.onSettled(from);
      const latest = adapter.getSnapshot();
      await drain();
      expect(source.setViewMode).toHaveBeenCalledTimes(1);
      writes[0].resolve(true);
      await drain();
      expect(adapter.getSnapshot()).toBe(latest);
      expect(jest.mocked(source.setViewMode).mock.calls).toEqual([
        [to],
        [from],
      ]);
      writes[1].resolve(true);
      await drain();
      expect(adapter.getSnapshot()).toBe(latest);
      expect(source.getSnapshot().viewMode).toBe(from);
    },
  );

  it('coalesces rapid settled choices to the latest without persisting intermediate pages', async () => {
    const { adapter, source, writes } = fixture();
    adapter.onSettled('pro');
    await drain();
    adapter.onSettled('simple');
    adapter.onSettled('pro');
    adapter.onSettled('simple');
    adapter.onSettled('pro');
    writes[0].resolve(true);
    await drain();
    expect(jest.mocked(source.setViewMode).mock.calls).toEqual([['pro']]);
    expect(adapter.getSnapshot().settledMode).toBe('pro');
  });

  it('coalesces multiple settlements before the persistence microtask starts', async () => {
    const { adapter, source } = fixture();
    adapter.onSettled('pro');
    adapter.onSettled('simple');
    await drain();
    expect(source.setViewMode).not.toHaveBeenCalled();
    expect(adapter.getSnapshot().settledMode).toBe('simple');
  });

  it('does not let duplicate old settlement or save completion erase a newer request', async () => {
    const { adapter, source, writes } = fixture();
    adapter.onSettled('pro');
    await drain();
    adapter.requestMode('simple');
    adapter.onSettled('pro');
    writes[0].resolve(true);
    await drain();
    expect(adapter.getSnapshot()).toEqual({
      requestedKey: 'simple',
      settledMode: 'pro',
    });
    expect(source.setViewMode).toHaveBeenCalledTimes(1);
  });

  it('follows an external persisted selection without redundantly saving it', async () => {
    const { adapter, source, publish } = fixture();
    publish({ viewMode: 'simple', savingMode: 'pro' });
    publish({ viewMode: 'pro', savingMode: null });
    expect(adapter.getSnapshot()).toEqual({
      requestedKey: 'pro',
      settledMode: 'simple',
    });
    adapter.onSettled('pro');
    await drain();
    expect(source.setViewMode).not.toHaveBeenCalled();
  });

  it('waits for an external flight but never lets its old echo override local intent', async () => {
    const { adapter, source, publish, writes } = fixture();
    publish({ viewMode: 'simple', savingMode: 'pro' });
    adapter.requestMode('simple');
    await drain();
    expect(source.setViewMode).not.toHaveBeenCalled();
    publish({ viewMode: 'pro', savingMode: null });
    expect(adapter.getSnapshot()).toEqual({
      requestedKey: 'simple',
      settledMode: 'simple',
    });
    await drain();
    expect(source.setViewMode).toHaveBeenCalledWith('simple');
    writes[0].resolve(true);
    await drain();
  });

  it('drains an accepted latest settlement after unmount without UI publication', async () => {
    const { adapter, source, writes, listeners } = fixture();
    const updates = jest.fn();
    adapter.subscribe(updates);
    adapter.onSettled('pro');
    await drain();
    adapter.onSettled('simple');
    adapter.setActive(false);
    const finalSnapshot = adapter.getSnapshot();
    updates.mockClear();
    expect(listeners.size).toBe(1);
    writes[0].resolve(true);
    await drain();
    expect(jest.mocked(source.setViewMode).mock.calls).toEqual([
      ['pro'],
      ['simple'],
    ]);
    adapter.requestMode('pro');
    adapter.onSettled('pro');
    writes[1].resolve(true);
    await drain();
    expect(source.getSnapshot().viewMode).toBe('simple');
    expect(adapter.getSnapshot()).toBe(finalSnapshot);
    expect(updates).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });

  it('drains a settled value awaiting an external save after unmount', async () => {
    const { adapter, source, publish, writes, listeners } = fixture();
    publish({ viewMode: 'simple', savingMode: 'pro' });
    adapter.requestMode('simple');
    adapter.setActive(false);
    await drain();
    expect(listeners.size).toBe(1);
    publish({ viewMode: 'pro', savingMode: null });
    await drain();
    expect(source.setViewMode).toHaveBeenCalledWith('simple');
    writes[0].resolve(true);
    await drain();
    expect(listeners.size).toBe(0);
  });

  it('does not persist an unsettled command after unmount', async () => {
    const { adapter, source, listeners } = fixture();
    adapter.requestMode('pro');
    adapter.setActive(false);
    await drain();
    expect(source.setViewMode).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });

  it.each([false, true])(
    'drops retired pending when replacement claims the same source (mount first=%s)',
    async mountFirst => {
      const { adapter, source, writes } = fixture();
      adapter.onSettled('pro');
      await drain();
      adapter.onSettled('simple');
      const replacement = createPerpsRootModeAdapter(source);
      if (!mountFirst) {
        adapter.setActive(false);
      }
      replacement.setActive(true);
      replacement.onSettled('pro');
      if (mountFirst) {
        adapter.setActive(false);
      }
      writes[0].resolve(true);
      await drain();
      expect(jest.mocked(source.setViewMode).mock.calls).toEqual([['pro']]);
      expect(replacement.getSnapshot()).toEqual({
        requestedKey: 'pro',
        settledMode: 'pro',
      });
      replacement.setActive(false);
    },
  );

  it('lets a retained route explicitly reclaim after the replacement unmounts', async () => {
    const { adapter, source, writes } = fixture();
    const replacement = createPerpsRootModeAdapter(source);
    replacement.setActive(true);
    replacement.setActive(false);
    adapter.requestMode('pro');
    adapter.onSettled('pro');
    adapter.setActive(false);
    await drain();
    expect(source.setViewMode).toHaveBeenCalledWith('pro');
    writes[0].resolve(true);
    await drain();
    expect(source.getSnapshot().viewMode).toBe('pro');
  });

  it('keeps a retained route settlement when no replacement owner remains', async () => {
    const { adapter, source, writes } = fixture();
    const replacement = createPerpsRootModeAdapter(source);
    replacement.setActive(true);
    replacement.setActive(false);
    adapter.onSettled('pro');
    adapter.setActive(false);
    await drain();
    expect(source.setViewMode).toHaveBeenCalledWith('pro');
    writes[0].resolve(true);
    await drain();
    expect(source.getSnapshot().viewMode).toBe('pro');
  });

  it('keeps UI snapshots stable for saving-only and equivalent source changes', async () => {
    const { adapter, publish } = fixture();
    const before = adapter.getSnapshot();
    publish({ viewMode: 'simple', savingMode: 'pro' });
    expect(adapter.getSnapshot()).toBe(before);
    publish({ viewMode: 'simple', savingMode: null });
    await drain();
    expect(adapter.getSnapshot()).toBe(before);
  });
});
