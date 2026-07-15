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

  it('requires dapp sync side effects to run after activation', () => {
    mockStartupScheduler();

    const { addDappSync } = require('./dapp') as typeof import('./dapp');
    const { registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const addDapp = jest.fn();
    const dapp = {
      origin: 'https://app.example',
      name: 'Example',
      chainId: 'eth',
    };
    expect(() => addDappSync(dapp as any)).toThrow(
      'Core service "dappService" is not registered',
    );

    registerService('dappService', {
      addDapp,
    } as any);

    addDappSync(dapp as any);

    expect(addDapp).toHaveBeenCalledWith(dapp);
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

  it('keeps preference command side effects synchronous after activation', () => {
    mockStartupScheduler();

    const {
      setUserBehaviorTrackingOptOutSync,
      toggleAllowNotifyAccountsChangedSync,
    } = require('./preference') as typeof import('./preference');
    const { registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const toggleAllowNotifyAccountsChanged = jest.fn();
    const setUserBehaviorTrackingOptOut = jest.fn();
    expect(() => toggleAllowNotifyAccountsChangedSync(true)).toThrow(
      'preferenceService is not ready',
    );

    registerService('preferenceService', {
      setUserBehaviorTrackingOptOut,
      toggleAllowNotifyAccountsChanged,
    } as any);

    toggleAllowNotifyAccountsChangedSync(true);
    setUserBehaviorTrackingOptOutSync(false);
    expect(toggleAllowNotifyAccountsChanged).toHaveBeenCalledWith(true);
    expect(setUserBehaviorTrackingOptOut).toHaveBeenCalledWith(false);
  });

  it('keeps startup contact alias updates synchronous', () => {
    mockStartupScheduler();

    const { updateContactAliasSync } =
      require('./contact') as typeof import('./contact');
    const { registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const updateAlias = jest.fn();
    const payload = { address: '0xabc', name: 'Main' };
    expect(() => updateContactAliasSync(payload)).toThrow(
      'contactService is not ready',
    );

    registerService('contactService', { updateAlias } as any);
    updateContactAliasSync(payload);

    expect(updateAlias).toHaveBeenCalledWith(payload);
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

  it('requires gas account sync side effects to run after activation', async () => {
    mockStartupScheduler();

    const { ensureGasAccountServiceReady, setGasAccountSigSync } =
      require('./gasAccount') as typeof import('./gasAccount');
    const { registerCoreServiceLoader, registerService } =
      require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');

    const setGasAccountSig = jest.fn();
    let finishLoader: (() => void) | undefined;
    registerCoreServiceLoader('gasAccountService', async () => {
      registerService('gasAccountService', {
        setGasAccountSig,
      } as any);
      await new Promise<void>(resolve => {
        finishLoader = resolve;
      });
    });

    const readiness = ensureGasAccountServiceReady();
    await flushDeferredServiceWork();

    expect(() =>
      setGasAccountSigSync('0xsig', { address: '0xabc' } as any),
    ).toThrow('Core service "gasAccountService" is not fully loaded');

    finishLoader?.();
    await readiness;

    setGasAccountSigSync('0xsig', { address: '0xabc' } as any);

    expect(setGasAccountSig).toHaveBeenCalledWith('0xsig', {
      address: '0xabc',
    });
  });
});
