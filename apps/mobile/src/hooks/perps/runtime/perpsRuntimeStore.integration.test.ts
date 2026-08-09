import type { Account } from '@/core/startupServices/preference';

import {
  ensurePerpsRuntime,
  resetPerpsRuntimeForTests,
  type PerpsRuntimeAccountContext,
  type PerpsRuntimeDependencies,
} from './ensurePerpsRuntime';
import {
  getPerpsRuntimeIdentity,
  getPerpsRuntimeSnapshot,
} from './perpsRuntimeState';

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const makeAccount = (address: string) =>
  ({
    address,
    brandName: 'Rabby',
    type: 'PrivateKey',
  } as Account);

describe('Perps Runtime state integration', () => {
  let accountContext: PerpsRuntimeAccountContext;

  const setAccount = (account: Account | null) => {
    accountContext = {
      account,
      generation: accountContext.generation + 1,
      isInitialized: false,
    };
  };

  const createDependencies = (
    overrides: Partial<PerpsRuntimeDependencies> = {},
  ): PerpsRuntimeDependencies => ({
    applyPerpsSigner: jest.fn(async () => undefined),
    fetchMarketData: jest.fn(async () => undefined),
    getOrCreatePerpsAgentWallet: jest.fn(async masterAddress => ({
      agentAddress: `agent-${masterAddress}`,
      vault: `vault-${masterAddress}`,
    })),
    getPerpsAccountRuntimeContext: () => accountContext,
    getPerpsAgentAddress: jest.fn(async address => `agent-${address}`),
    initPerpsAgentAccount: jest.fn(),
    isSelfSignPerpsAccount: jest.fn(() => true),
    isWalletUnlocked: jest.fn(() => true),
    loginPerpsAccount: jest.fn(async () => undefined),
    setInitialized: initialized => {
      accountContext = { ...accountContext, isInitialized: initialized };
    },
    waitForInitialWsData: jest.fn(async () => undefined),
    ...overrides,
  });

  beforeEach(() => {
    resetPerpsRuntimeForTests();
    accountContext = {
      account: null,
      generation: 0,
      isInitialized: false,
    };
  });

  afterEach(() => {
    resetPerpsRuntimeForTests();
  });

  it('deduplicates concurrent initialization and commits readiness once', async () => {
    const signer = createDeferred<void>();
    const account = makeAccount('0x0000000000000000000000000000000000000001');
    const applyPerpsSigner = jest.fn(async () => signer.promise);
    const dependencies = createDependencies({ applyPerpsSigner });
    setAccount(account);

    const requests = Array.from({ length: 8 }, () =>
      ensurePerpsRuntime({
        account,
        dependencies,
        isInitialized: false,
      }),
    );

    expect(requests.every(request => request === requests[0])).toBe(true);
    await Promise.resolve();
    expect(applyPerpsSigner).toHaveBeenCalledTimes(1);

    signer.resolve();
    await Promise.all(requests);

    expect(accountContext.isInitialized).toBe(true);
    expect(dependencies.loginPerpsAccount).toHaveBeenCalledTimes(1);
    expect(dependencies.fetchMarketData).toHaveBeenCalledTimes(1);
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      identity: getPerpsRuntimeIdentity(account),
      status: 'ready',
    });
  });

  it('rejects a stale account generation before it can commit readiness', async () => {
    const accountASigner = createDeferred<void>();
    const accountA = makeAccount('0x000000000000000000000000000000000000000a');
    const accountB = makeAccount('0x000000000000000000000000000000000000000b');
    const applyPerpsSigner = jest.fn(async (account: Account) => {
      if (account.address === accountA.address) {
        await accountASigner.promise;
      }
    });
    const dependencies = createDependencies({ applyPerpsSigner });
    setAccount(accountA);

    const accountARequest = ensurePerpsRuntime({
      account: accountA,
      dependencies,
      isInitialized: false,
    });
    await Promise.resolve();
    expect(applyPerpsSigner).toHaveBeenCalledWith(accountA);

    setAccount(accountB);
    accountASigner.resolve();
    await accountARequest;

    expect(accountContext).toMatchObject({
      account: accountB,
      isInitialized: false,
    });
    expect(dependencies.loginPerpsAccount).not.toHaveBeenCalled();

    await ensurePerpsRuntime({
      account: accountB,
      dependencies,
      isInitialized: false,
    });

    expect(dependencies.loginPerpsAccount).toHaveBeenCalledTimes(1);
    expect(dependencies.loginPerpsAccount).toHaveBeenCalledWith(accountB);
    expect(accountContext).toMatchObject({
      account: accountB,
      isInitialized: true,
    });
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      identity: getPerpsRuntimeIdentity(accountB),
      status: 'ready',
    });
  });
});
