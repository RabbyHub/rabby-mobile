import type { Account } from '@/core/startupServices/preference';
import {
  UserAbstractionResp,
  type ClearinghouseState,
} from '@rabby-wallet/hyperliquid-sdk';

const mockGetClearingHouseState = jest.fn();
const mockGetSpotClearingHouseState = jest.fn();
const mockGetUserAbstraction = jest.fn();
const mockWsSubscribe = jest.fn();

const wsSubscription = (name: string) =>
  jest.fn((...args: unknown[]) => {
    mockWsSubscribe(name, ...args);
    return { unsubscribe: jest.fn() };
  });

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));
jest.mock('@/core/utils/startupDiagnostics', () => ({
  traceStartupDiagnostic: jest.fn(),
}));
jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      info: {
        getClearingHouseState: (...args: unknown[]) =>
          mockGetClearingHouseState(...args),
        getSpotClearingHouseState: (...args: unknown[]) =>
          mockGetSpotClearingHouseState(...args),
        getUserAbstraction: (...args: unknown[]) =>
          mockGetUserAbstraction(...args),
        getDelegatorSummary: jest.fn(async () => ({
          delegated: '0',
          undelegated: '0',
          totalPendingWithdrawal: '0',
          nPendingWithdrawals: 0,
        })),
      },
      ws: {
        subscribeToAllDexsAssetCtxs: wsSubscription('allDexsAssetCtxs'),
        subscribeToFastAssetCtxs: wsSubscription('fastAssetCtxs'),
        subscribeToAllDexsClearinghouseState: wsSubscription(
          'allDexsClearinghouseState',
        ),
        subscribeToSpotState: wsSubscription('spotState'),
        subscribeToOpenOrders: wsSubscription('openOrders'),
        subscribeToUserFills: wsSubscription('userFills'),
        subscribeToUserNonFundingLedgerUpdates: wsSubscription(
          'userNonFundingLedgerUpdates',
        ),
      },
    }),
  },
}));
jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getUserAbstractionForAddress: jest.fn(async () => null),
    setUserAbstractionForAddress: jest.fn(async () => undefined),
    clearUserAbstractionForAddress: jest.fn(async () => undefined),
    setCurrentAccount: jest.fn(async () => undefined),
  },
}));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: jest.fn(),
  scheduleStartupTask: jest.fn(),
}));
jest.mock('@/utils/events', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), removeAllListeners: jest.fn() },
  EVENTS: { PERPS: {} },
}));

import {
  initialState,
  perpsStore,
  subscribeToUserData,
  switchPerpsAccountBeforeNavigate,
} from './usePerpsStore';

const ACCOUNT_A = {
  address: '0x1111111111111111111111111111111111111111',
  brandName: 'Rabby',
  type: 'PrivateKeyring',
} as Account;
const ACCOUNT_B = {
  address: '0x2222222222222222222222222222222222222222',
  brandName: 'Rabby',
  type: 'PrivateKeyring',
} as Account;

const buildClearinghouseState = (
  accountValue: string,
  time: number,
): ClearinghouseState => ({
  assetPositions: [],
  crossMaintenanceMarginUsed: '0',
  crossMarginSummary: {
    accountValue,
    totalMarginUsed: '0',
    totalNtlPos: '0',
    totalRawUsd: accountValue,
  },
  marginSummary: {
    accountValue,
    totalMarginUsed: '0',
    totalNtlPos: '0',
    totalRawUsd: accountValue,
  },
  time,
  withdrawable: accountValue,
});

const SPOT_STATE = {
  balances: [{ coin: 'USDC', token: 0, total: '5', hold: '0', entryNtl: '0' }],
};

const httpCalls = () => ({
  mode: mockGetUserAbstraction.mock.calls.length,
  user: mockGetClearingHouseState.mock.calls.length,
  spot: mockGetSpotClearingHouseState.mock.calls.length,
});

describe('account readiness fallback', () => {
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    perpsStore.setState({ ...initialState });
    mockGetClearingHouseState.mockResolvedValue(
      buildClearinghouseState('12.5', 10),
    );
    mockGetSpotClearingHouseState.mockResolvedValue(SPOT_STATE);
    mockGetUserAbstraction.mockResolvedValue(UserAbstractionResp.default);
  });

  afterEach(() => {
    switchPerpsAccountBeforeNavigate(ACCOUNT_B);
    consoleWarn.mockRestore();
    jest.useRealTimers();
  });

  it('binds every user stream to the account address, not the SDK master', () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });

    subscribeToUserData(ACCOUNT_A);

    for (const name of [
      'spotState',
      'openOrders',
      'userFills',
      'userNonFundingLedgerUpdates',
    ]) {
      const call = mockWsSubscribe.mock.calls.find(([n]) => n === name);
      expect(call?.[2]).toBe(ACCOUNT_A.address);
    }
  });

  it('pulls http snapshots for whatever is still missing after the first frames never arrive', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    subscribeToUserData(ACCOUNT_A);
    expect(httpCalls()).toEqual({ mode: 0, user: 0, spot: 0 });

    await jest.advanceTimersByTimeAsync(8_000);

    // Mode unknown -> spot is pulled too, it may still be spot-collateral.
    expect(httpCalls()).toEqual({ mode: 1, user: 1, spot: 1 });
    const state = perpsStore.getState();
    expect(state.userAbstractionReady).toBe(true);
    expect(state.isUserDataReady).toBe(true);
    expect(state.isSpotStateReady).toBe(true);

    await jest.advanceTimersByTimeAsync(120_000);
    expect(httpCalls()).toEqual({ mode: 1, user: 1, spot: 1 });
  });

  it('stays idle when the streams delivered in time', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    subscribeToUserData(ACCOUNT_A);
    perpsStore.setState({
      isUserDataReady: true,
      isSpotStateReady: true,
      userAbstraction: UserAbstractionResp.unifiedAccount,
      userAbstractionReady: true,
      userAbstractionOwnerAddress: ACCOUNT_A.address,
    });

    await jest.advanceTimersByTimeAsync(120_000);

    expect(httpCalls()).toEqual({ mode: 0, user: 0, spot: 0 });
  });

  it('skips the spot snapshot for a resolved manual account', async () => {
    perpsStore.setState({
      currentPerpsAccount: ACCOUNT_A,
      userAbstraction: UserAbstractionResp.default,
      userAbstractionReady: true,
      userAbstractionOwnerAddress: ACCOUNT_A.address,
    });
    subscribeToUserData(ACCOUNT_A);

    await jest.advanceTimersByTimeAsync(8_000);

    expect(httpCalls()).toEqual({ mode: 0, user: 1, spot: 0 });
    expect(perpsStore.getState().isUserDataReady).toBe(true);
  });

  it('is cancelled by an account switch', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    subscribeToUserData(ACCOUNT_A);

    switchPerpsAccountBeforeNavigate(ACCOUNT_B);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(httpCalls()).toEqual({ mode: 0, user: 0, spot: 0 });
  });

  it('keeps retrying with backoff while the fallback itself fails', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    mockGetUserAbstraction.mockRejectedValue(new Error('offline'));
    mockGetClearingHouseState.mockRejectedValue(new Error('offline'));
    mockGetSpotClearingHouseState.mockRejectedValue(new Error('offline'));
    subscribeToUserData(ACCOUNT_A);

    await jest.advanceTimersByTimeAsync(8_000);
    expect(httpCalls()).toEqual({ mode: 1, user: 1, spot: 1 });

    await jest.advanceTimersByTimeAsync(15_000);
    expect(httpCalls()).toEqual({ mode: 2, user: 2, spot: 2 });

    // Network back: the next tick resolves everything and the loop ends.
    mockGetUserAbstraction.mockResolvedValue(UserAbstractionResp.default);
    mockGetClearingHouseState.mockResolvedValue(
      buildClearinghouseState('12.5', 10),
    );
    mockGetSpotClearingHouseState.mockResolvedValue(SPOT_STATE);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(httpCalls()).toEqual({ mode: 3, user: 3, spot: 3 });
    expect(perpsStore.getState().isUserDataReady).toBe(true);

    await jest.advanceTimersByTimeAsync(300_000);
    expect(httpCalls()).toEqual({ mode: 3, user: 3, spot: 3 });
  });
});
