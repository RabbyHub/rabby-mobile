import type {
  PerpsProTpSlModePreferenceSelection,
  PerpsProTpSlModePreferences,
} from '@/core/services/perpsService';

import { createPerpsProTpSlModePreferencesController } from './usePerpsProTpSlModePreferences';

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const defaults: PerpsProTpSlModePreferences = {
  opening: { sl: 'price', tp: 'price' },
  position: { sl: 'pnl', tp: 'pnl' },
};

const createController = (
  overrides: Partial<{
    getPreferences: () => Promise<PerpsProTpSlModePreferences>;
    setPreference: (
      selection: PerpsProTpSlModePreferenceSelection,
    ) => Promise<unknown>;
  }> = {},
) =>
  createPerpsProTpSlModePreferencesController({
    getPreferences: overrides.getPreferences ?? (async () => defaults),
    setPreference: overrides.setPreference ?? (async () => undefined),
  });

describe('Perps Pro TP/SL mode preferences controller', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('hydrates Opening and Position preferences independently', async () => {
    const controller = createController({
      getPreferences: async () => ({
        opening: { sl: 'roi', tp: 'pnl' },
        position: { sl: 'pnl', tp: 'roi' },
      }),
    });

    const first = controller.hydrate();
    expect(controller.hydrate()).toBe(first);
    await first;

    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      opening: { sl: 'roi', tp: 'pnl' },
      position: { sl: 'pnl', tp: 'roi' },
    });
  });

  it('does not let late hydration overwrite an early leg selection', async () => {
    const read = deferred<PerpsProTpSlModePreferences>();
    const controller = createController({ getPreferences: () => read.promise });

    const hydration = controller.hydrate();
    await controller.setMode({ leg: 'tp', mode: 'roi', surface: 'opening' });
    read.resolve(defaults);
    await hydration;

    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      opening: { sl: 'price', tp: 'roi' },
      position: { sl: 'pnl', tp: 'pnl' },
    });
  });

  it('rolls back only the failed surface and leg', async () => {
    const failedWrite = deferred<unknown>();
    const controller = createController({
      setPreference: selection =>
        selection.surface === 'position' && selection.leg === 'sl'
          ? failedWrite.promise
          : Promise.resolve(),
    });
    await controller.hydrate();

    const pending = controller.setMode({
      leg: 'sl',
      mode: 'roi',
      surface: 'position',
    });
    await controller.setMode({ leg: 'tp', mode: 'pnl', surface: 'opening' });
    failedWrite.resolve(Promise.reject(new Error('write failed')));
    await pending;

    expect(controller.getSnapshot()).toEqual({
      hydrated: true,
      opening: { sl: 'price', tp: 'pnl' },
      position: { sl: 'pnl', tp: 'pnl' },
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[perpsProTpSlModePreferences] save failed',
      expect.any(Error),
    );
  });
});
