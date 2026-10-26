import type { Account } from '@/core/startupServices/preference';

import {
  ensurePerpsRuntime,
  resetPerpsRuntimeForTests,
  retryPerpsRuntime,
  type PerpsRuntimeDependencies,
} from './ensurePerpsRuntime';
import { registerLegacyRuntimeContinuation } from './legacyRuntimeContinuation';
import {
  getPerpsRuntimeIdentity,
  getPerpsRuntimeSnapshot,
} from './perpsRuntimeState';

const makeAccount = (address: string, type = 'self') =>
  ({ address, type, brandName: 'Rabby' } as Account);

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const createDependencies = ({
  calls = [],
  overrides = {},
}: {
  calls?: string[];
  overrides?: Partial<PerpsRuntimeDependencies>;
} = {}) => {
  let accountContext = {
    account: null as Account | null,
    generation: 0,
    isInitialized: false,
  };
  const setAccountContext = (
    account: Account | null,
    isInitialized = false,
  ) => {
    const previousIdentity = accountContext.account
      ? getPerpsRuntimeIdentity(accountContext.account)
      : null;
    const nextIdentity = account ? getPerpsRuntimeIdentity(account) : null;
    accountContext = {
      account,
      generation:
        previousIdentity === nextIdentity
          ? accountContext.generation
          : accountContext.generation + 1,
      isInitialized,
    };
  };

  const mocks = {
    getPerpsAccountRuntimeContext: jest.fn(() => accountContext),
    isSelfSignPerpsAccount: jest.fn(
      (accountType?: string) => accountType === 'self',
    ),
    isWalletUnlocked: jest.fn(() => true),
    applyPerpsSigner: jest.fn(async (account: Account) => {
      calls.push(`signer:${account.address}`);
    }),
    getPerpsAgentAddress: jest.fn(async (masterAddress: string) => {
      calls.push(`getAgent:${masterAddress}`);
      return `agent-${masterAddress}`;
    }),
    getOrCreatePerpsAgentWallet: jest.fn(async (masterAddress: string) => {
      calls.push(`getWallet:${masterAddress}`);
      return {
        vault: `vault-${masterAddress}`,
        agentAddress: `agent-${masterAddress}`,
      };
    }),
    initPerpsAgentAccount: jest.fn(
      (
        masterAddress: string,
        _vault: string | undefined,
        agentAddress: string,
      ) => {
        calls.push(`initAgent:${masterAddress}:${agentAddress}`);
      },
    ),
    loginPerpsAccount: jest.fn(async (account: Account) => {
      calls.push(`login:${account.address}`);
    }),
    fetchMarketData: jest.fn(async () => {
      calls.push('market');
    }),
    waitForInitialWsData: jest.fn(async () => {
      calls.push('wait');
    }),
    setInitialized: jest.fn((initialized: boolean) => {
      calls.push(`initialized:${String(initialized)}`);
      accountContext = {
        ...accountContext,
        isInitialized: initialized,
      };
    }),
  };

  const dependencies: PerpsRuntimeDependencies = {
    ...mocks,
    ...overrides,
  };

  return { calls, dependencies, mocks, setAccountContext };
};

describe('ensurePerpsRuntime', () => {
  beforeEach(() => {
    resetPerpsRuntimeForTests();
  });

  it('shares one promise and one initialization for ten concurrent callers of the same identity', async () => {
    const signer = createDeferred<void>();
    const calls: string[] = [];
    const applyPerpsSigner = jest.fn(async (account: Account) => {
      calls.push(`signer:${account.address}`);
      await signer.promise;
    });
    const { dependencies, mocks, setAccountContext } = createDependencies({
      calls,
      overrides: { applyPerpsSigner },
    });
    const account = makeAccount('0xA');
    setAccountContext(account);

    const promises = Array.from({ length: 10 }, () =>
      ensurePerpsRuntime({
        account,
        isInitialized: false,
        dependencies,
      }),
    );

    expect(promises.every(promise => promise === promises[0])).toBe(true);
    await Promise.resolve();
    expect(applyPerpsSigner).toHaveBeenCalledTimes(1);

    signer.resolve();
    await Promise.all(promises);

    expect(mocks.loginPerpsAccount).toHaveBeenCalledTimes(1);
    expect(mocks.fetchMarketData).toHaveBeenCalledTimes(1);
    expect(mocks.waitForInitialWsData).toHaveBeenCalledTimes(1);
    expect(mocks.setInitialized).toHaveBeenCalledTimes(1);
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      status: 'ready',
      identity: getPerpsRuntimeIdentity(account),
      origin: 'runtime',
    });
  });

  it('prevents stale account A from committing after account B replaces it', async () => {
    const accountASigner = createDeferred<void>();
    const calls: string[] = [];
    const applyPerpsSigner = jest.fn(async (account: Account) => {
      calls.push(`signer:${account.address}`);
      if (account.address === '0xA') {
        await accountASigner.promise;
      }
    });
    const { dependencies, mocks, setAccountContext } = createDependencies({
      calls,
      overrides: { applyPerpsSigner },
    });
    const accountA = makeAccount('0xA');
    const accountB = makeAccount('0xB');
    setAccountContext(accountA);

    const accountAPromise = ensurePerpsRuntime({
      account: accountA,
      isInitialized: false,
      dependencies,
    });
    await Promise.resolve();
    expect(applyPerpsSigner).toHaveBeenCalledWith(accountA);

    setAccountContext(accountB);
    const accountBPromise = ensurePerpsRuntime({
      account: accountB,
      isInitialized: false,
      dependencies,
    });
    await Promise.resolve();
    expect(
      applyPerpsSigner.mock.calls.map(([account]) => account.address),
    ).toEqual(['0xA']);

    accountASigner.resolve();
    await Promise.all([accountAPromise, accountBPromise]);

    expect(
      applyPerpsSigner.mock.calls.map(([account]) => account.address),
    ).toEqual(['0xA', '0xB']);
    expect(
      mocks.loginPerpsAccount.mock.calls.map(([account]) => account.address),
    ).toEqual(['0xB']);
    expect(mocks.setInitialized).toHaveBeenCalledTimes(1);
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      status: 'ready',
      identity: getPerpsRuntimeIdentity(accountB),
    });
  });

  it('blocks stale success during the Store-to-effect gap before account B starts', async () => {
    const accountASigner = createDeferred<void>();
    const applyPerpsSigner = jest.fn(async (account: Account) => {
      if (account.address === '0xA') {
        await accountASigner.promise;
      }
    });
    const { dependencies, mocks, setAccountContext } = createDependencies({
      overrides: { applyPerpsSigner },
    });
    const accountA = makeAccount('0xA');
    const accountB = makeAccount('0xB');
    setAccountContext(accountA);

    const accountAPromise = ensurePerpsRuntime({
      account: accountA,
      isInitialized: false,
      dependencies,
    });
    await Promise.resolve();
    expect(applyPerpsSigner).toHaveBeenCalledWith(accountA);

    // The Store has already switched, but React has not run ensure(B) yet.
    setAccountContext(accountB);
    accountASigner.resolve();
    await accountAPromise;

    expect(mocks.loginPerpsAccount).not.toHaveBeenCalled();
    expect(mocks.setInitialized).not.toHaveBeenCalled();
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      status: 'initializing',
      identity: getPerpsRuntimeIdentity(accountA),
    });

    await ensurePerpsRuntime({
      account: accountB,
      isInitialized: false,
      dependencies,
    });
    expect(mocks.loginPerpsAccount).toHaveBeenCalledWith(accountB);
    expect(mocks.setInitialized).toHaveBeenCalledTimes(1);
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      status: 'ready',
      identity: getPerpsRuntimeIdentity(accountB),
    });
  });

  it('drops a stale rejection after logout before the null effect runs', async () => {
    const loginStarted = createDeferred<void>();
    const loginResult = createDeferred<void>();
    const loginPerpsAccount = jest.fn(async () => {
      loginStarted.resolve();
      await loginResult.promise;
    });
    const { dependencies, mocks, setAccountContext } = createDependencies({
      overrides: { loginPerpsAccount },
    });
    const account = makeAccount('0xLogout');
    setAccountContext(account);

    const runtimePromise = ensurePerpsRuntime({
      account,
      isInitialized: false,
      dependencies,
    });
    await loginStarted.promise;

    // logout() changes the Store synchronously; ensure(null) is still pending.
    setAccountContext(null);
    loginResult.reject(new Error('old account login failed'));
    await runtimePromise;

    expect(mocks.setInitialized).not.toHaveBeenCalled();
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      status: 'initializing',
      identity: getPerpsRuntimeIdentity(account),
      phase: 'login',
    });
  });

  it('invalidates account A after an A-to-B-to-A context round trip', async () => {
    const signer = createDeferred<void>();
    const applyPerpsSigner = jest.fn(async () => {
      await signer.promise;
    });
    const { dependencies, mocks, setAccountContext } = createDependencies({
      overrides: { applyPerpsSigner },
    });
    const accountA = makeAccount('0xA');
    const accountB = makeAccount('0xB');
    setAccountContext(accountA);

    const stalePromise = ensurePerpsRuntime({
      account: accountA,
      isInitialized: false,
      dependencies,
    });
    await Promise.resolve();

    setAccountContext(accountB);
    setAccountContext(accountA);
    signer.resolve();
    await stalePromise;

    expect(mocks.loginPerpsAccount).not.toHaveBeenCalled();
    expect(mocks.setInitialized).not.toHaveBeenCalled();

    await ensurePerpsRuntime({
      account: accountA,
      isInitialized: false,
      dependencies,
    });
    expect(applyPerpsSigner).toHaveBeenCalledTimes(2);
    expect(mocks.loginPerpsAccount).toHaveBeenCalledTimes(1);
    expect(mocks.setInitialized).toHaveBeenCalledTimes(1);
  });

  it('preserves the self-sign branch order and runs its focused continuation', async () => {
    const calls: string[] = [];
    const { dependencies, setAccountContext } = createDependencies({ calls });
    const account = makeAccount('0xSelf');
    setAccountContext(account);
    registerLegacyRuntimeContinuation(getPerpsRuntimeIdentity(account), {
      selfSign: () => {
        calls.push('continuation:self');
      },
      lockedAgent: () => undefined,
      unlockedAgent: () => undefined,
    });

    await ensurePerpsRuntime({
      account,
      isInitialized: false,
      dependencies,
    });

    expect(calls).toEqual([
      'signer:0xSelf',
      'login:0xSelf',
      'market',
      'wait',
      'continuation:self',
      'initialized:true',
    ]);
  });

  it('keeps locked-agent initialization passive and flushes its pending continuation later', async () => {
    const calls: string[] = [];
    const { dependencies, mocks, setAccountContext } = createDependencies({
      calls,
      overrides: {
        isSelfSignPerpsAccount: jest.fn(() => false),
        isWalletUnlocked: jest.fn(() => false),
      },
    });
    const account = makeAccount('0xLocked', 'hardware');
    setAccountContext(account);

    await ensurePerpsRuntime({
      account,
      isInitialized: false,
      dependencies,
    });

    expect(mocks.applyPerpsSigner).not.toHaveBeenCalled();
    expect(mocks.getOrCreatePerpsAgentWallet).not.toHaveBeenCalled();
    expect(mocks.initPerpsAgentAccount).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'getAgent:0xLocked',
      'login:0xLocked',
      'market',
      'wait',
      'initialized:true',
    ]);

    // The Store update reruns the Hook with isInitialized=true. A Runtime-owned
    // ready generation must keep its pending continuation instead of being
    // reclassified as external-ready.
    await ensurePerpsRuntime({
      account,
      isInitialized: true,
      dependencies,
    });

    const lockedAgent = jest.fn();
    registerLegacyRuntimeContinuation(getPerpsRuntimeIdentity(account), {
      selfSign: () => undefined,
      lockedAgent,
      unlockedAgent: () => undefined,
    });
    expect(lockedAgent).toHaveBeenCalledTimes(1);
    expect(lockedAgent).toHaveBeenCalledWith('agent-0xLocked');
  });

  it('preserves the unlocked-agent order and starts continuation before baseline', async () => {
    const calls: string[] = [];
    const { dependencies, mocks, setAccountContext } = createDependencies({
      calls,
      overrides: {
        isSelfSignPerpsAccount: jest.fn(() => false),
        isWalletUnlocked: jest.fn(() => true),
      },
    });
    const account = makeAccount('0xUnlocked', 'hardware');
    setAccountContext(account);
    registerLegacyRuntimeContinuation(getPerpsRuntimeIdentity(account), {
      selfSign: () => undefined,
      lockedAgent: () => undefined,
      unlockedAgent: agentAddress => {
        calls.push(`continuation:unlocked:${agentAddress}`);
      },
    });

    await ensurePerpsRuntime({
      account,
      isInitialized: false,
      dependencies,
    });

    expect(mocks.applyPerpsSigner).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'getWallet:0xUnlocked',
      'initAgent:0xUnlocked:agent-0xUnlocked',
      'login:0xUnlocked',
      'continuation:unlocked:agent-0xUnlocked',
      'market',
      'wait',
      'initialized:true',
    ]);
  });

  it('adopts an already initialized account as external-ready without work or continuation', async () => {
    const { dependencies, mocks, setAccountContext } = createDependencies();
    const account = makeAccount('0xExternal');
    setAccountContext(account, true);
    const selfSign = jest.fn();
    registerLegacyRuntimeContinuation(getPerpsRuntimeIdentity(account), {
      selfSign,
      lockedAgent: () => undefined,
      unlockedAgent: () => undefined,
    });

    await ensurePerpsRuntime({
      account,
      isInitialized: true,
      dependencies,
    });

    expect(mocks.isSelfSignPerpsAccount).not.toHaveBeenCalled();
    expect(mocks.applyPerpsSigner).not.toHaveBeenCalled();
    expect(mocks.loginPerpsAccount).not.toHaveBeenCalled();
    expect(mocks.fetchMarketData).not.toHaveBeenCalled();
    expect(mocks.setInitialized).not.toHaveBeenCalled();
    expect(selfSign).not.toHaveBeenCalled();
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      status: 'ready',
      identity: getPerpsRuntimeIdentity(account),
      origin: 'external',
    });
  });

  it.each([
    {
      phase: 'signer',
      overrides: {
        applyPerpsSigner: jest.fn(async () => {
          throw new Error('signer failed');
        }),
      },
    },
    {
      phase: 'login',
      overrides: {
        loginPerpsAccount: jest.fn(async () => {
          throw new Error('login failed');
        }),
      },
    },
    {
      phase: 'baseline',
      overrides: {
        fetchMarketData: jest.fn(async () => {
          throw new Error('baseline failed');
        }),
      },
    },
  ])(
    'classifies a $phase failure without committing initialized',
    async ({ phase, overrides }) => {
      const { dependencies, mocks, setAccountContext } = createDependencies({
        overrides,
      });
      const account = makeAccount(`0x${phase}`);
      setAccountContext(account);

      await ensurePerpsRuntime({
        account,
        isInitialized: false,
        dependencies,
      });

      expect(mocks.setInitialized).not.toHaveBeenCalled();
      expect(getPerpsRuntimeSnapshot()).toMatchObject({
        status: 'error',
        phase,
        origin: 'runtime',
      });
      expect(getPerpsRuntimeSnapshot().error).toBeInstanceOf(Error);
    },
  );

  it('retries a failed identity with a new generation', async () => {
    const signerError = new Error('first signer failed');
    const applyPerpsSigner = jest
      .fn<
        ReturnType<PerpsRuntimeDependencies['applyPerpsSigner']>,
        Parameters<PerpsRuntimeDependencies['applyPerpsSigner']>
      >()
      .mockRejectedValueOnce(signerError)
      .mockResolvedValue(undefined);
    const { dependencies, mocks, setAccountContext } = createDependencies({
      overrides: { applyPerpsSigner },
    });
    const account = makeAccount('0xRetry');
    setAccountContext(account);

    await ensurePerpsRuntime({
      account,
      isInitialized: false,
      dependencies,
    });
    const failedGeneration = getPerpsRuntimeSnapshot().generation;

    await retryPerpsRuntime();

    expect(applyPerpsSigner).toHaveBeenCalledTimes(2);
    expect(mocks.setInitialized).toHaveBeenCalledTimes(1);
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      status: 'ready',
      identity: getPerpsRuntimeIdentity(account),
    });
    expect(getPerpsRuntimeSnapshot().generation).toBeGreaterThan(
      failedGeneration,
    );
  });

  it('moves to waitingForAccount and performs no runtime work without an account', async () => {
    const { dependencies, mocks } = createDependencies();

    await ensurePerpsRuntime({
      account: null,
      isInitialized: false,
      dependencies,
    });

    expect(mocks.applyPerpsSigner).not.toHaveBeenCalled();
    expect(mocks.loginPerpsAccount).not.toHaveBeenCalled();
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      status: 'waitingForAccount',
      identity: null,
      origin: null,
    });
  });

  it('normalizes address casing but keeps account type in the runtime identity', () => {
    expect(getPerpsRuntimeIdentity(makeAccount('0xAbC', 'type-a'))).toBe(
      getPerpsRuntimeIdentity(makeAccount('0xaBc', 'type-a')),
    );
    expect(getPerpsRuntimeIdentity(makeAccount('0xAbC', 'type-a'))).not.toBe(
      getPerpsRuntimeIdentity(makeAccount('0xAbC', 'type-b')),
    );
  });

  it('does not flush an old identity pending continuation into a new generation', async () => {
    const { dependencies, setAccountContext } = createDependencies({
      overrides: {
        isSelfSignPerpsAccount: jest.fn(() => false),
        isWalletUnlocked: jest.fn(() => false),
      },
    });
    const accountA = makeAccount('0xA', 'hardware');
    const accountB = makeAccount('0xB', 'hardware');
    setAccountContext(accountA);

    await ensurePerpsRuntime({
      account: accountA,
      isInitialized: false,
      dependencies,
    });
    setAccountContext(accountB);
    await ensurePerpsRuntime({
      account: accountB,
      isInitialized: false,
      dependencies,
    });

    const accountACheck = jest.fn();
    const accountBCheck = jest.fn();
    registerLegacyRuntimeContinuation(getPerpsRuntimeIdentity(accountA), {
      selfSign: () => undefined,
      lockedAgent: accountACheck,
      unlockedAgent: () => undefined,
    });
    registerLegacyRuntimeContinuation(getPerpsRuntimeIdentity(accountB), {
      selfSign: () => undefined,
      lockedAgent: accountBCheck,
      unlockedAgent: () => undefined,
    });

    expect(accountACheck).not.toHaveBeenCalled();
    expect(accountBCheck).toHaveBeenCalledTimes(1);
    expect(accountBCheck).toHaveBeenCalledWith('agent-0xB');
  });
});
