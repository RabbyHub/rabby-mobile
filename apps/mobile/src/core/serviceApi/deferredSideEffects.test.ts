function flushDeferredServiceWork() {
  return new Promise(resolve => setImmediate(resolve));
}

function mockStartupScheduler() {
  jest.doMock('@/core/utils/startupScheduler', () => ({
    runOnDemandStartupTask: (task: () => unknown) => Promise.resolve(task()),
  }));
}

describe('core/serviceApi deferred side effects', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('runs dapp sync side effects after the service is loaded', async () => {
    mockStartupScheduler();

    const { addDappSync } = require('./dapp') as typeof import('./dapp');
    const { registerCoreServiceLoader, registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const addDapp = jest.fn();
    registerCoreServiceLoader('dappService', () => {
      registerService('dappService', {
        addDapp,
      } as any);
    });

    expect(() =>
      addDappSync({
        origin: 'https://app.example',
        name: 'Example',
        chainId: 'eth',
      } as any),
    ).not.toThrow();
    expect(addDapp).not.toHaveBeenCalled();

    await flushDeferredServiceWork();

    expect(addDapp).toHaveBeenCalledWith({
      origin: 'https://app.example',
      name: 'Example',
      chainId: 'eth',
    });
  });

  it('requires notification sync side effects to run after activation', () => {
    mockStartupScheduler();

    const { setNotificationStatsDataSync } =
      require('./notification') as typeof import('./notification');
    const { registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const setStatsData = jest.fn();
    const statsData = { type: 'personalSign', signed: true };
    expect(() => setNotificationStatsDataSync(statsData as any)).toThrow(
      'Core service "notificationService" is not registered',
    );

    registerService('notificationService', {
      setStatsData,
    } as any);

    setNotificationStatsDataSync(statsData as any);
    expect(setStatsData).toHaveBeenCalledWith(statsData);
  });

  it('keeps notification sync side effects unavailable until its loader completes', async () => {
    mockStartupScheduler();

    const { ensureNotificationServiceReady, setNotificationStatsDataSync } =
      require('./notification') as typeof import('./notification');
    const { registerCoreServiceLoader, registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const setStatsData = jest.fn();
    let finishLoader: (() => void) | undefined;
    registerCoreServiceLoader('notificationService', async () => {
      registerService('notificationService', {
        setStatsData,
      } as any);
      await new Promise<void>(resolve => {
        finishLoader = resolve;
      });
    });

    const readiness = ensureNotificationServiceReady();
    await flushDeferredServiceWork();

    expect(() => setNotificationStatsDataSync(undefined)).toThrow(
      'Core service "notificationService" is not fully loaded',
    );

    finishLoader?.();
    await readiness;

    setNotificationStatsDataSync(undefined);
    expect(setStatsData).toHaveBeenCalledWith(undefined);
  });

  it('keeps ready services synchronous', () => {
    mockStartupScheduler();

    const { setGasAccountSigSync } =
      require('./gasAccount') as typeof import('./gasAccount');
    const { registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const setGasAccountSig = jest.fn();
    registerService('gasAccountService', {
      setGasAccountSig,
    } as any);

    setGasAccountSigSync('0xsig', { address: '0xabc' } as any);

    expect(setGasAccountSig).toHaveBeenCalledWith('0xsig', {
      address: '0xabc',
    });
  });
});
