import { act, renderHook } from '@testing-library/react-native';
import { useLayoutEffect } from 'react';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { createPerpsViewModeController } from '@/hooks/perps/viewMode/perpsViewModeController';
import { usePerpsRootModeAdapter } from './usePerpsRootModeAdapter';
import { createPerpsRootModeAdapter } from './perpsRootModeAdapter';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function drain() {
  for (let index = 0; index < 16; index += 1) {
    await Promise.resolve();
  }
}

async function fixture({
  initialMode = 'simple',
  write = async (_mode: PerpsViewMode) => undefined,
}: {
  initialMode?: PerpsViewMode;
  write?: (mode: PerpsViewMode) => Promise<void>;
} = {}) {
  // Real preference owner and route adapter; only persistence I/O is a fake.
  let diskMode = initialMode;
  const written: PerpsViewMode[] = [];
  const controller = createPerpsViewModeController({
    getPerpsViewModePreference: async () => ({
      viewMode: diskMode,
      hasVisitedPro: diskMode === 'pro',
    }),
    setPerpsViewMode: async mode => {
      written.push(mode);
      await write(mode);
      diskMode = mode;
    },
  });
  await controller.hydrate();
  const committedCommands: PerpsViewMode[] = [];
  const hook = renderHook(() => {
    const adapter = usePerpsRootModeAdapter(controller);
    useLayoutEffect(() => {
      committedCommands.push(adapter.requestedKey);
    }, [adapter.requestedKey]);
    return adapter;
  });
  return {
    ...hook,
    committedCommands,
    controller,
    written,
    getDiskMode: () => diskMode,
  };
}

describe('Perps root preference integration', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('uses hydrated Pro and stable event handlers without a temporary Simple command', async () => {
    const { result, rerender, committedCommands, written } = await fixture({
      initialMode: 'pro',
    });
    const before = result.current;
    rerender(undefined);
    expect(result.current).toBe(before);
    expect(committedCommands).toEqual(['pro']);
    expect(written).toEqual([]);
    expect(result.current).toMatchObject({
      requestedKey: 'pro',
      settledMode: 'pro',
    });
  });

  it('does not visit or persist Pro for a cancelled preview', async () => {
    const { result, controller, written } = await fixture();
    const before = result.current;
    await act(async () => {
      result.current.onSettled('simple');
      await drain();
    });
    expect(written).toEqual([]);
    expect(controller.getSnapshot().hasVisitedPro).toBe(false);
    expect(result.current).toBe(before);
  });

  it.each([
    ['simple', 'pro'],
    ['pro', 'simple'],
  ] as const)(
    'publishes %s to %s settlement without waiting for preference I/O',
    async (from, to) => {
      const write = deferred();
      const { result, controller, written, getDiskMode } = await fixture({
        initialMode: from,
        write: () => write.promise,
      });
      act(() => result.current.requestMode(to));
      expect(result.current).toMatchObject({
        requestedKey: to,
        settledMode: from,
      });
      expect(written).toEqual([]);
      act(() => result.current.onSettled(to));
      const settled = result.current;
      expect(settled).toMatchObject({ requestedKey: to, settledMode: to });
      await act(async () => {
        await drain();
      });
      expect(result.current).toBe(settled);
      expect(controller.getSnapshot()).toMatchObject({
        viewMode: from,
        savingMode: to,
      });
      await act(async () => {
        write.resolve();
        await drain();
      });
      expect(getDiskMode()).toBe(to);
      expect(result.current).toBe(settled);
    },
  );

  it('never rolls back on failure, and retries only a later explicit action', async () => {
    let fail = true;
    const { result, committedCommands, written, getDiskMode, controller } =
      await fixture({
        write: async () => {
          if (fail) {
            throw new Error('storage unavailable');
          }
        },
      });
    await act(async () => {
      result.current.onSettled('pro');
      await drain();
    });
    const settled = result.current;
    expect(committedCommands).toEqual(['simple', 'pro']);
    expect(settled).toMatchObject({ requestedKey: 'pro', settledMode: 'pro' });
    expect(written).toEqual(['pro']);
    expect(getDiskMode()).toBe('simple');
    expect(controller.getSnapshot().hasVisitedPro).toBe(false);
    await act(async () => {
      result.current.onSettled('pro');
      await drain();
    });
    expect(written).toEqual(['pro']);
    fail = false;
    await act(async () => {
      result.current.requestMode('pro');
      await drain();
    });
    expect(written).toEqual(['pro', 'pro']);
    expect(getDiskMode()).toBe('pro');
    expect(result.current).toBe(settled);
  });

  it.each([
    ['simple', 'pro'],
    ['pro', 'simple'],
  ] as const)(
    'reverses %s through %s while the first save remains pending',
    async (from, to) => {
      const write = deferred();
      const { result, written, getDiskMode, committedCommands } = await fixture(
        {
          initialMode: from,
          write: mode => (mode === to ? write.promise : Promise.resolve()),
        },
      );
      await act(async () => {
        result.current.onSettled(to);
        await drain();
      });
      act(() => result.current.requestMode(from));
      expect(result.current.requestedKey).toBe(from);
      await act(async () => {
        result.current.onSettled(from);
        await drain();
      });
      expect(result.current.settledMode).toBe(from);
      expect(written).toEqual([to]);
      await act(async () => {
        write.resolve();
        await drain();
      });
      expect(written).toEqual([to, from]);
      expect(getDiskMode()).toBe(from);
      expect(committedCommands).toEqual([from, to, from]);
      expect(result.current).toMatchObject({
        requestedKey: from,
        settledMode: from,
      });
    },
  );

  it('coalesces settled transitions while keeping an unsettled latest command immediate', async () => {
    const write = deferred();
    const { result, written, getDiskMode } = await fixture({
      write: mode => (mode === 'pro' ? write.promise : Promise.resolve()),
    });
    await act(async () => {
      result.current.onSettled('pro');
      await drain();
    });
    act(() => {
      result.current.onSettled('simple');
      result.current.onSettled('pro');
      result.current.onSettled('simple');
      result.current.requestMode('pro');
    });
    expect(result.current).toMatchObject({
      requestedKey: 'pro',
      settledMode: 'simple',
    });
    await act(async () => {
      write.resolve();
      await drain();
    });
    expect(written).toEqual(['pro', 'simple']);
    expect(getDiskMode()).toBe('simple');
    expect(result.current.requestedKey).toBe('pro');
  });

  it('follows a successful fresh external preference command without another write', async () => {
    const { result, controller, written } = await fixture();
    await act(async () => {
      await controller.setViewMode('pro');
      await drain();
    });
    expect(result.current).toMatchObject({
      requestedKey: 'pro',
      settledMode: 'simple',
    });
    await act(async () => {
      result.current.onSettled('pro');
      await drain();
    });
    expect(written).toEqual(['pro']);
    expect(result.current.settledMode).toBe('pro');
  });

  it('waits for an external save without blocking or overriding newer local intent', async () => {
    const write = deferred();
    const { result, controller, written, getDiskMode } = await fixture({
      write: mode => (mode === 'pro' ? write.promise : Promise.resolve()),
    });
    let externalSave!: Promise<boolean>;
    await act(async () => {
      externalSave = controller.setViewMode('pro');
      await drain();
    });
    act(() => result.current.requestMode('pro'));
    expect(result.current.requestedKey).toBe('pro');
    act(() => result.current.requestMode('simple'));
    expect(result.current.requestedKey).toBe('simple');
    expect(written).toEqual(['pro']);
    await act(async () => {
      write.resolve();
      await externalSave;
      await drain();
    });
    expect(written).toEqual(['pro', 'simple']);
    expect(result.current).toMatchObject({
      requestedKey: 'simple',
      settledMode: 'simple',
    });
    expect(getDiskMode()).toBe('simple');
  });

  it('drains latest accepted settlement after unmount but ignores later callbacks', async () => {
    const write = deferred();
    const { result, unmount, written, getDiskMode, committedCommands } =
      await fixture({
        write: mode => (mode === 'pro' ? write.promise : Promise.resolve()),
      });
    await act(async () => {
      result.current.onSettled('pro');
      await drain();
    });
    act(() => result.current.onSettled('simple'));
    const handlers = result.current;
    unmount();
    const before = [...committedCommands];
    await act(async () => {
      handlers.onSettled('pro');
      handlers.requestMode('pro');
      write.resolve();
      await drain();
    });
    expect(written).toEqual(['pro', 'simple']);
    expect(getDiskMode()).toBe('simple');
    expect(committedCommands).toEqual(before);
  });

  it('drains accepted settlement after unmount while an external flight is pending', async () => {
    const write = deferred();
    const { result, controller, unmount, written, getDiskMode } = await fixture(
      {
        write: mode => (mode === 'pro' ? write.promise : Promise.resolve()),
      },
    );
    let external!: Promise<boolean>;
    await act(async () => {
      external = controller.setViewMode('pro');
      await drain();
    });
    act(() => result.current.requestMode('simple'));
    unmount();
    await act(async () => {
      write.resolve();
      await external;
      await drain();
    });
    expect(written).toEqual(['pro', 'simple']);
    expect(getDiskMode()).toBe('simple');
  });

  it.each([false, true])(
    'hands off retired pending to a new route choosing the in-flight mode (mount first=%s)',
    async mountFirst => {
      const write = deferred();
      const previous = await fixture({ write: () => write.promise });
      await act(async () => {
        previous.result.current.onSettled('pro');
        await drain();
      });
      act(() => previous.result.current.onSettled('simple'));
      if (!mountFirst) {
        previous.unmount();
      }
      const next = renderHook(() =>
        usePerpsRootModeAdapter(previous.controller),
      );
      expect(next.result.current.settledMode).toBe('simple');
      act(() => next.result.current.onSettled('pro'));
      if (mountFirst) {
        previous.unmount();
      }
      await act(async () => {
        write.resolve();
        await drain();
      });
      expect(previous.written).toEqual(['pro']);
      expect(previous.getDiskMode()).toBe('pro');
      expect(next.result.current).toMatchObject({
        requestedKey: 'pro',
        settledMode: 'pro',
      });
      next.unmount();
    },
  );

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'does not replay retired pending after a completion subscriber starts another save (subscriber first=%s, failure=%s)',
    async (subscriberFirst, failure) => {
      const first = deferred();
      const second = deferred();
      let diskMode: PerpsViewMode = 'simple';
      const written: PerpsViewMode[] = [];
      const controller = createPerpsViewModeController({
        getPerpsViewModePreference: async () => ({
          viewMode: diskMode,
          hasVisitedPro: false,
        }),
        setPerpsViewMode: async mode => {
          written.push(mode);
          await (mode === 'pro' ? first.promise : second.promise);
          diskMode = mode;
        },
      });
      await controller.hydrate();
      const adapter = createPerpsRootModeAdapter(controller);
      let nextSave: Promise<boolean> | undefined;
      let startedNext = false;
      if (!subscriberFirst) {
        adapter.setActive(true);
      }
      const unsubscribe = controller.subscribe(() => {
        const current = controller.getSnapshot();
        if (
          !startedNext &&
          current.viewMode === 'pro' &&
          current.savingMode === null
        ) {
          startedNext = true;
          nextSave = controller.setViewMode('simple');
        }
      });
      if (subscriberFirst) {
        adapter.setActive(true);
      }
      try {
        adapter.onSettled('pro');
        await drain();
        adapter.onSettled('simple');
        if (!failure) {
          adapter.onSettled('pro');
        }
        adapter.setActive(false);
        const retiredSnapshot = adapter.getSnapshot();
        first.resolve();
        await drain();
        expect(written).toEqual(['pro', 'simple']);
        if (failure) {
          second.reject(new Error('new consumer write failed'));
        } else {
          second.resolve();
        }
        await nextSave;
        await drain();
        expect(written).toEqual(['pro', 'simple']);
        expect(diskMode).toBe(failure ? 'pro' : 'simple');
        expect(adapter.getSnapshot()).toBe(retiredSnapshot);
      } finally {
        first.resolve();
        second.resolve();
        await drain();
        adapter.setActive(false);
        unsubscribe();
      }
    },
  );

  it('tolerates synchronous external-store delivery before controller finally', async () => {
    const write = deferred();
    let diskMode: PerpsViewMode = 'simple';
    const written: PerpsViewMode[] = [];
    const controller = createPerpsViewModeController({
      getPerpsViewModePreference: async () => ({
        viewMode: diskMode,
        hasVisitedPro: false,
      }),
      setPerpsViewMode: async mode => {
        written.push(mode);
        if (mode === 'pro') {
          await write.promise;
        }
        diskMode = mode;
      },
    });
    await controller.hydrate();
    const adapter = createPerpsRootModeAdapter(controller);
    adapter.setActive(true);
    try {
      const external = controller.setViewMode('pro');
      adapter.requestMode('simple');
      write.resolve();
      await external;
      await drain();
      expect(written).toEqual(['pro', 'simple']);
      expect(diskMode).toBe('simple');
      expect(adapter.getSnapshot()).toEqual({
        requestedKey: 'simple',
        settledMode: 'simple',
      });
    } finally {
      adapter.setActive(false);
    }
  });

  it('shares a save already announced to synchronous subscribers', async () => {
    const write = deferred();
    const written: PerpsViewMode[] = [];
    const controller = createPerpsViewModeController({
      getPerpsViewModePreference: async () => ({
        viewMode: 'simple',
        hasVisitedPro: false,
      }),
      setPerpsViewMode: async mode => {
        written.push(mode);
        await write.promise;
      },
    });
    await controller.hydrate();
    let entered = false;
    let subscriberRequest: Promise<boolean> | undefined;
    const unsubscribe = controller.subscribe(() => {
      if (controller.getSnapshot().savingMode === 'pro' && !entered) {
        entered = true;
        subscriberRequest = controller.setViewMode('pro');
      }
    });
    try {
      const original = controller.setViewMode('pro');
      expect(subscriberRequest).toBe(original);
      write.resolve();
      await original;
      expect(written).toEqual(['pro']);
    } finally {
      write.resolve();
      await drain();
      unsubscribe();
    }
  });
});
