import type { Account } from '@/core/startupServices/preference';

jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: jest.fn(),
  scheduleStartupTask: jest.fn(),
}));

jest.mock('@/core/utils/reexports', () => ({
  zCreate: require('zustand').create,
}));

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {},
}));

jest.mock('@/core/request', () => ({
  openapi: {},
}));

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {},
}));

jest.mock('@/utils/events', () => ({
  EVENTS: {
    PERPS: {
      LOG_OUT: 'PERPS_LOG_OUT',
    },
  },
  eventBus: {
    emit: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

jest.mock('@/utils/stats', () => ({
  stats: {},
}));

jest.mock('@/utils/perps', () => ({
  formatAllDexsClearinghouseState: jest.fn(),
  formatMarkData: jest.fn(),
  formatPositionPnl: jest.fn(() => ({
    accountValue: 0,
    pnl: 0,
    show: false,
    type: 'pnl',
  })),
  formatSpotState: jest.fn(),
  getPxDecimals: jest.fn(() => 2),
  mergeFastAssetCtxs: jest.fn(),
}));

const { getPerpsAccountRuntimeContext, initialState, perpsStore } =
  require('../usePerpsStore') as typeof import('../usePerpsStore');
const { ensurePerpsRuntime, resetPerpsRuntimeForTests } =
  require('./ensurePerpsRuntime') as typeof import('./ensurePerpsRuntime');
type PerpsRuntimeDependencies =
  import('./ensurePerpsRuntime').PerpsRuntimeDependencies;
const { getPerpsRuntimeIdentity, getPerpsRuntimeSnapshot } =
  require('./perpsRuntimeState') as typeof import('./perpsRuntimeState');

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

const setAccount = (account: Account | null) => {
  perpsStore.setState({
    currentPerpsAccount: account,
    isInitialized: false,
    isLogin: !!account,
  });
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
  getPerpsAccountRuntimeContext,
  getPerpsAgentAddress: jest.fn(async address => `agent-${address}`),
  initPerpsAgentAccount: jest.fn(),
  isSelfSignPerpsAccount: jest.fn(() => true),
  isWalletUnlocked: jest.fn(() => true),
  loginPerpsAccount: jest.fn(async () => undefined),
  setInitialized: initialized => {
    perpsStore.setState({ isInitialized: initialized });
  },
  waitForInitialWsData: jest.fn(async () => undefined),
  ...overrides,
});

const resetStore = () => {
  perpsStore.setState({ ...initialState }, true);
};

describe('Perps Runtime and Store integration', () => {
  beforeEach(() => {
    resetPerpsRuntimeForTests();
    resetStore();
  });

  afterEach(() => {
    resetPerpsRuntimeForTests();
    resetStore();
  });

  it('deduplicates concurrent initialization and commits readiness to the real Store', async () => {
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

    expect(perpsStore.getState().isInitialized).toBe(true);
    expect(dependencies.loginPerpsAccount).toHaveBeenCalledTimes(1);
    expect(dependencies.fetchMarketData).toHaveBeenCalledTimes(1);
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      identity: getPerpsRuntimeIdentity(account),
      status: 'ready',
    });
  });

  it('rejects an old account generation before it can mutate the real Store', async () => {
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

    expect(perpsStore.getState()).toMatchObject({
      currentPerpsAccount: accountB,
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
    expect(perpsStore.getState()).toMatchObject({
      currentPerpsAccount: accountB,
      isInitialized: true,
    });
    expect(getPerpsRuntimeSnapshot()).toMatchObject({
      identity: getPerpsRuntimeIdentity(accountB),
      status: 'ready',
    });
  });
});
