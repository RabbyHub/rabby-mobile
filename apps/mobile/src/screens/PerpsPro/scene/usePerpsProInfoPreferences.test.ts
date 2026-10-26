import type {
  PerpsProInfoTab,
  PerpsProInfoTabPreference,
} from '@/core/services/perpsService';

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
    getPerpsProInfoTabPreference?: () => Promise<PerpsProInfoTabPreference>;
    setPerpsProInfoTab?: (tab: PerpsProInfoTab) => Promise<unknown>;
  } = {},
) =>
  createPerpsProInfoPreferencesController({
    getPerpsProInfoTabPreference:
      overrides.getPerpsProInfoTabPreference ??
      (async () => ({
        activeInfoTab: 'account',
        hasUserSelectedInfoTab: false,
      })),
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
    const getTab = jest.fn(async () => ({
      activeInfoTab: 'positions' as const,
      hasUserSelectedInfoTab: true,
    }));
    const controller = createController({
      getPerpsProInfoTabPreference: getTab,
    });

    const first = controller.hydrate();
    const second = controller.hydrate();
    expect(second).toBe(first);
    await first;

    expect(controller.getSnapshot()).toEqual({
      activeInfoTab: 'positions',
      hasUserSelectedInfoTab: true,
      hydrated: true,
    });
    expect(getTab).toHaveBeenCalledTimes(1);
  });

  it('does not let a late hydration response overwrite early user choices', async () => {
    const tabRead = deferred<PerpsProInfoTabPreference>();
    const controller = createController({
      getPerpsProInfoTabPreference: () => tabRead.promise,
    });

    const hydration = controller.hydrate();
    await controller.setActiveInfoTab('openOrders');
    tabRead.resolve({
      activeInfoTab: 'account',
      hasUserSelectedInfoTab: false,
    });
    await hydration;

    expect(controller.getSnapshot()).toEqual({
      activeInfoTab: 'openOrders',
      hasUserSelectedInfoTab: true,
      hydrated: true,
    });
  });

  it('rolls back a failed optimistic tab write', async () => {
    const error = new Error('tab write failed');
    const controller = createController({
      getPerpsProInfoTabPreference: async () => ({
        activeInfoTab: 'positions',
        hasUserSelectedInfoTab: true,
      }),
      setPerpsProInfoTab: async () => {
        throw error;
      },
    });
    await controller.hydrate();
    await controller.setActiveInfoTab('openOrders');

    expect(controller.getSnapshot()).toEqual({
      activeInfoTab: 'positions',
      hasUserSelectedInfoTab: true,
      hydrated: true,
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[perpsProInfoPreferences] save tab failed',
      error,
    );
  });
});
