import type { PerpsViewMode } from '@/core/services/perpsService';

import { createPerpsViewModeController } from './usePerpsViewMode';

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const createController = ({
  getPerpsViewModePreference = jest.fn(async () => ({
    hasVisitedPro: false,
    viewMode: 'simple' as PerpsViewMode,
  })),
  setPerpsViewMode = jest.fn(async () => undefined),
}: {
  getPerpsViewModePreference?: jest.Mock<
    Promise<{ hasVisitedPro: boolean; viewMode: PerpsViewMode }>,
    []
  >;
  setPerpsViewMode?: jest.Mock<Promise<unknown>, [PerpsViewMode]>;
} = {}) => {
  const controller = createPerpsViewModeController({
    getPerpsViewModePreference,
    setPerpsViewMode,
  });
  return { controller, getPerpsViewModePreference, setPerpsViewMode };
};

describe('Perps view mode controller', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shares one hydration read and publishes one immutable snapshot', async () => {
    const read = createDeferred<{
      hasVisitedPro: boolean;
      viewMode: PerpsViewMode;
    }>();
    const getPerpsViewModePreference = jest.fn(() => read.promise);
    const { controller } = createController({ getPerpsViewModePreference });
    const listener = jest.fn();
    controller.subscribe(listener);

    const firstHydration = controller.hydrate();
    const secondHydration = controller.hydrate();

    expect(firstHydration).toBe(secondHydration);
    expect(getPerpsViewModePreference).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(getPerpsViewModePreference).toHaveBeenCalledTimes(1);

    read.resolve({ hasVisitedPro: true, viewMode: 'pro' });
    await firstHydration;

    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      hasVisitedPro: true,
      viewMode: 'pro',
      savingMode: null,
      error: null,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    await controller.hydrate();
    expect(getPerpsViewModePreference).toHaveBeenCalledTimes(1);
  });

  it('fails open to Simple after hydration rejection without writing', async () => {
    const error = new Error('read failed');
    const getPerpsViewModePreference = jest.fn(async () => {
      throw error;
    });
    const { controller, setPerpsViewMode } = createController({
      getPerpsViewModePreference,
    });

    await controller.hydrate();

    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      hasVisitedPro: false,
      viewMode: 'simple',
      savingMode: null,
      error,
    });
    expect(setPerpsViewMode).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[perpsViewMode] hydrate failed',
      error,
    );
  });

  it('does not write when the requested mode is already active', async () => {
    const { controller, setPerpsViewMode } = createController();
    await controller.hydrate();

    await expect(controller.setViewMode('simple')).resolves.toBe(true);
    expect(setPerpsViewMode).not.toHaveBeenCalled();
  });

  it('keeps the old mode visible until persistence succeeds', async () => {
    const write = createDeferred<unknown>();
    const setPerpsViewMode = jest.fn(() => write.promise);
    const { controller } = createController({ setPerpsViewMode });
    await controller.hydrate();

    const savePromise = controller.setViewMode('pro');
    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      hasVisitedPro: false,
      viewMode: 'simple',
      savingMode: 'pro',
      error: null,
    });
    await Promise.resolve();
    expect(setPerpsViewMode).toHaveBeenCalledWith('pro');

    write.resolve(undefined);
    await expect(savePromise).resolves.toBe(true);
    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      hasVisitedPro: true,
      viewMode: 'pro',
      savingMode: null,
      error: null,
    });
  });

  it('reuses the same-target save and rejects an opposite target in flight', async () => {
    const write = createDeferred<unknown>();
    const setPerpsViewMode = jest.fn(() => write.promise);
    const { controller } = createController({ setPerpsViewMode });
    await controller.hydrate();

    const firstSave = controller.setViewMode('pro');
    const sameTargetSave = controller.setViewMode('pro');
    const oppositeTargetSave = controller.setViewMode('simple');

    expect(sameTargetSave).toBe(firstSave);
    await expect(oppositeTargetSave).resolves.toBe(false);
    await Promise.resolve();
    expect(setPerpsViewMode).toHaveBeenCalledTimes(1);

    write.resolve(undefined);
    await firstSave;
  });

  it('retains the active mode and exposes the original save error for retry', async () => {
    const error = new Error('write failed');
    const setPerpsViewMode = jest
      .fn<Promise<unknown>, [PerpsViewMode]>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);
    const { controller } = createController({ setPerpsViewMode });
    await controller.hydrate();

    await expect(controller.setViewMode('pro')).resolves.toBe(false);
    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      hasVisitedPro: false,
      viewMode: 'simple',
      savingMode: null,
      error,
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[perpsViewMode] save failed',
      error,
    );

    await expect(controller.setViewMode('pro')).resolves.toBe(true);
    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      hasVisitedPro: true,
      viewMode: 'pro',
      savingMode: null,
      error: null,
    });
  });

  it('hydrates before handling a mode request made by an early consumer', async () => {
    const getPerpsViewModePreference = jest.fn(async () => ({
      hasVisitedPro: false,
      viewMode: 'simple' as const,
    }));
    const { controller, setPerpsViewMode } = createController({
      getPerpsViewModePreference,
    });

    await expect(controller.setViewMode('pro')).resolves.toBe(true);

    expect(getPerpsViewModePreference).toHaveBeenCalledTimes(1);
    expect(setPerpsViewMode).toHaveBeenCalledWith('pro');
    expect(controller.getSnapshot().viewMode).toBe('pro');
  });

  it('notifies every mounted consumer from the same controller snapshot', async () => {
    const { controller } = createController();
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const unsubscribeFirst = controller.subscribe(firstListener);
    controller.subscribe(secondListener);

    await controller.hydrate();
    await controller.setViewMode('pro');

    expect(firstListener).toHaveBeenCalledTimes(3);
    expect(secondListener).toHaveBeenCalledTimes(3);
    unsubscribeFirst();

    await controller.setViewMode('simple');
    expect(firstListener).toHaveBeenCalledTimes(3);
    expect(secondListener).toHaveBeenCalledTimes(5);
  });
});
