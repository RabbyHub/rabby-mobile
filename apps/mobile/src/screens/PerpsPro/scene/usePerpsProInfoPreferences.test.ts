import type { PerpsProInfoTab } from '@/core/services/perpsService';

import { createPerpsProInfoPreferencesController } from './usePerpsProInfoPreferences';

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const createController = (
  overrides: {
    getPerpsProInfoTab?: () => Promise<PerpsProInfoTab>;
    setPerpsProInfoTab?: (tab: PerpsProInfoTab) => Promise<unknown>;
  } = {},
) =>
  createPerpsProInfoPreferencesController({
    getPerpsProInfoTab: overrides.getPerpsProInfoTab ?? (async () => 'account'),
    setPerpsProInfoTab: overrides.setPerpsProInfoTab ?? (async () => undefined),
  });

describe('Perps Pro info preferences controller', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shares hydration and restores persisted values', async () => {
    const getTab = jest.fn(async () => 'positions' as const);
    const controller = createController({
      getPerpsProInfoTab: getTab,
    });

    const first = controller.hydrate();
    const second = controller.hydrate();
    expect(second).toBe(first);
    await first;

    expect(controller.getSnapshot()).toEqual({
      activeInfoTab: 'positions',
      hydrated: true,
    });
    expect(getTab).toHaveBeenCalledTimes(1);
  });

  it('does not let a late hydration response overwrite early user choices', async () => {
    const tabRead = deferred<PerpsProInfoTab>();
    const controller = createController({
      getPerpsProInfoTab: () => tabRead.promise,
    });

    const hydration = controller.hydrate();
    await controller.setActiveInfoTab('openOrders');
    tabRead.resolve('account');
    await hydration;

    expect(controller.getSnapshot()).toEqual({
      activeInfoTab: 'openOrders',
      hydrated: true,
    });
  });

  it('rolls back a failed optimistic tab write', async () => {
    const error = new Error('tab write failed');
    const controller = createController({
      getPerpsProInfoTab: async () => 'positions',
      setPerpsProInfoTab: async () => {
        throw error;
      },
    });
    await controller.hydrate();
    await controller.setActiveInfoTab('openOrders');

    expect(controller.getSnapshot()).toEqual({
      activeInfoTab: 'positions',
      hydrated: true,
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[perpsProInfoPreferences] save tab failed',
      error,
    );
  });
});
