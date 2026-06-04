function loadWalletUnlockGuardModule(isUnlocked: boolean) {
  jest.resetModules();

  const mockIsUnlocked = jest.fn(() => isUnlocked);

  jest.doMock('@/core/apis/lock', () => ({
    isUnlocked: (...args: unknown[]) => mockIsUnlocked(...args),
  }));
  jest.doMock('@rabby-wallet/keyring-utils', () => ({
    KEYRING_TYPE: {
      HdKeyring: 'HdKeyring',
      SimpleKeyring: 'SimpleKeyring',
      WatchAddressKeyring: 'WatchAddressKeyring',
    },
  }));

  const walletUnlockGuard =
    require('./walletUnlockGuard') as typeof import('./walletUnlockGuard');

  return {
    ...walletUnlockGuard,
    mocks: {
      mockIsUnlocked,
    },
  };
}

describe('utils/walletUnlockGuard', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('resolves immediately when the wallet is already unlocked', async () => {
    const { ensureWalletUnlocked, mocks } = loadWalletUnlockGuardModule(true);

    await expect(ensureWalletUnlocked()).resolves.toBeUndefined();

    expect(mocks.mockIsUnlocked).toHaveBeenCalledTimes(1);
  });

  it('throws the unlock sentinel error when locked and no requester is registered', async () => {
    const { ensureWalletUnlocked, isWalletUnlockRequired } =
      loadWalletUnlockGuardModule(false);

    await expect(ensureWalletUnlocked()).rejects.toThrow(
      'background.error.unlock',
    );
    expect(isWalletUnlockRequired(new Error('background.error.unlock'))).toBe(
      true,
    );
    expect(isWalletUnlockRequired(new Error('other'))).toBe(false);
  });

  it('delegates to the registered requester when locked', async () => {
    const { ensureWalletUnlocked, setWalletUnlockRequester } =
      loadWalletUnlockGuardModule(false);
    const requester = jest.fn().mockResolvedValue(undefined);

    setWalletUnlockRequester(requester);

    await expect(ensureWalletUnlocked()).resolves.toBeUndefined();
    expect(requester).toHaveBeenCalledTimes(1);
  });

  it('classifies only sensitive keyring types as requiring unlock', () => {
    const { isSensitiveKeyringType } = loadWalletUnlockGuardModule(true);

    expect(isSensitiveKeyringType('SimpleKeyring')).toBe(true);
    expect(isSensitiveKeyringType('HdKeyring')).toBe(true);
    expect(isSensitiveKeyringType('WatchAddressKeyring')).toBe(false);
    expect(isSensitiveKeyringType(undefined)).toBe(false);
  });

  it('wraps async work with unconditional and conditional unlock checks', async () => {
    const unlocked = loadWalletUnlockGuardModule(true);
    const guarded = jest.fn(async (value: number) => value + 1);

    await expect(unlocked.withWalletUnlock(guarded)(1)).resolves.toBe(2);
    expect(guarded).toHaveBeenCalledWith(1);
    expect(unlocked.mocks.mockIsUnlocked).toHaveBeenCalledTimes(1);

    const locked = loadWalletUnlockGuardModule(false);
    const requester = jest.fn().mockResolvedValue(undefined);
    const conditionalGuarded = jest.fn(async (value: number) => value * 2);
    locked.setWalletUnlockRequester(requester);

    await expect(
      locked.withWalletUnlockIf(
        (value: number) => value > 0,
        conditionalGuarded,
      )(2),
    ).resolves.toBe(4);
    await expect(
      locked.withWalletUnlockIf(
        (value: number) => value > 0,
        conditionalGuarded,
      )(0),
    ).resolves.toBe(0);

    expect(requester).toHaveBeenCalledTimes(1);
    expect(conditionalGuarded).toHaveBeenCalledTimes(2);
  });
});
