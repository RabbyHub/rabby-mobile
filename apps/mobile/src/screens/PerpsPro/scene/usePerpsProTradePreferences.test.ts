import type {
  PerpsProTradeAmountUnit,
  PerpsProTradeOrderType,
} from '@/core/services/perpsService';

import { createPerpsProTradePreferencesController } from './usePerpsProTradePreferences';

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createController = (
  overrides: Partial<{
    getAmountUnit: () => Promise<PerpsProTradeAmountUnit>;
    getOrderType: () => Promise<PerpsProTradeOrderType>;
    setAmountUnit: (value: PerpsProTradeAmountUnit) => Promise<unknown>;
    setOrderType: (value: PerpsProTradeOrderType) => Promise<unknown>;
  }> = {},
) =>
  createPerpsProTradePreferencesController({
    getAmountUnit: overrides.getAmountUnit ?? (async () => 'quote'),
    getOrderType: overrides.getOrderType ?? (async () => 'market'),
    setAmountUnit: overrides.setAmountUnit ?? (async () => undefined),
    setOrderType: overrides.setOrderType ?? (async () => undefined),
  });

describe('Perps Pro trade preferences controller', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shares hydration and restores both persisted trade preferences', async () => {
    const controller = createController({
      getAmountUnit: async () => 'base',
      getOrderType: async () => 'conditional',
    });

    const first = controller.hydrate();
    expect(controller.hydrate()).toBe(first);
    await first;

    expect(controller.getSnapshot()).toEqual({
      amountUnit: 'base',
      hydrated: true,
      orderType: 'conditional',
    });
  });

  it('does not let late hydration overwrite either early user choice', async () => {
    const amountRead = deferred<PerpsProTradeAmountUnit>();
    const orderRead = deferred<PerpsProTradeOrderType>();
    const controller = createController({
      getAmountUnit: () => amountRead.promise,
      getOrderType: () => orderRead.promise,
    });

    const hydration = controller.hydrate();
    await controller.setAmountUnit('base');
    await controller.setOrderType('limit');
    amountRead.resolve('quote');
    orderRead.resolve('market');
    await hydration;

    expect(controller.getSnapshot()).toEqual({
      amountUnit: 'base',
      hydrated: true,
      orderType: 'limit',
    });
  });

  it('rolls back only the failed field when writes overlap', async () => {
    const amountWrite = deferred<unknown>();
    const controller = createController({
      setAmountUnit: () => amountWrite.promise,
      setOrderType: async () => undefined,
    });
    await controller.hydrate();

    const pendingAmount = controller.setAmountUnit('base');
    await controller.setOrderType('limit');
    amountWrite.resolve(Promise.reject(new Error('amount write failed')));
    await pendingAmount;

    expect(controller.getSnapshot()).toEqual({
      amountUnit: 'quote',
      hydrated: true,
      orderType: 'limit',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[perpsProTradePreferences] save amount unit failed',
      expect.any(Error),
    );
  });
});
