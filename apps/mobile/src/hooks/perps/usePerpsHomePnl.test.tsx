import { act, renderHook } from '@testing-library/react-native';
import type { Account } from '@/core/startupServices/preference';
import type { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';

const mockGetClearingHouseState = jest.fn();
const mockGetSpotClearingHouseState = jest.fn();

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));
jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      info: {
        getClearingHouseState: (...args: unknown[]) =>
          mockGetClearingHouseState(...args),
        getSpotClearingHouseState: (...args: unknown[]) =>
          mockGetSpotClearingHouseState(...args),
      },
    }),
  },
}));
jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getUserAbstractionForAddress: jest.fn(async () => null),
    setUserAbstractionForAddress: jest.fn(async () => undefined),
    clearUserAbstractionForAddress: jest.fn(async () => undefined),
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
  HOME_PERPS_PNL_WS_FALLBACK_MS,
  usePerpsHomePnl,
} from './usePerpsHomePnl';
import { initialState, perpsStore } from './usePerpsStore';

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

// Network-resolved manual mode with no WS frame yet: the badge's usual
// "waiting for the first clearinghouse frame" state.
const seedWaitingManualAccount = (account: Account) => {
  perpsStore.setState({
    ...initialState,
    currentPerpsAccount: account,
    userAbstractionReady: true,
    userAbstractionOwnerAddress: account.address,
  });
};

const elapseFallbackWindow = async () => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(HOME_PERPS_PNL_WS_FALLBACK_MS);
  });
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
};

describe('usePerpsHomePnl', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    perpsStore.setState({ ...initialState });
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.useRealTimers();
  });

  it('treats a cached abstraction for the current address as a known mode', () => {
    perpsStore.setState({
      ...initialState,
      currentPerpsAccount: ACCOUNT_A,
      userAbstractionReady: false,
      userAbstractionCachedAddress: ACCOUNT_A.address,
      isUserDataReady: true,
    });

    const { result } = renderHook(() => usePerpsHomePnl());

    expect(result.current.perpsPositionInfo.isLoading).toBe(false);
    expect(result.current.perpsPositionInfo.show).toBe(true);
    expect(result.current.perpsPositionInfo.type).toBe('accountValue');
  });

  it('keeps the skeleton until the WS fallback window elapses', () => {
    seedWaitingManualAccount(ACCOUNT_A);

    const { result } = renderHook(() => usePerpsHomePnl());

    expect(result.current.perpsPositionInfo.isLoading).toBe(true);
    act(() => {
      jest.advanceTimersByTime(HOME_PERPS_PNL_WS_FALLBACK_MS - 1);
    });
    expect(result.current.perpsPositionInfo.isLoading).toBe(true);
    expect(mockGetClearingHouseState).not.toHaveBeenCalled();
  });

  it('pulls an HTTP snapshot after the window and renders it', async () => {
    seedWaitingManualAccount(ACCOUNT_A);
    mockGetClearingHouseState.mockResolvedValue(
      buildClearinghouseState('42', 100),
    );

    const { result } = renderHook(() => usePerpsHomePnl());
    await elapseFallbackWindow();

    expect(mockGetClearingHouseState).toHaveBeenCalledWith(
      ACCOUNT_A.address,
      undefined,
    );
    expect(result.current.perpsPositionInfo.isLoading).toBe(false);
    expect(result.current.perpsPositionInfo.show).toBe(true);
    expect(result.current.perpsPositionInfo.type).toBe('accountValue');
    expect(result.current.perpsPositionInfo.availableBalance).toBe(42);
  });

  it('releases the skeleton without a value when the fallback also fails', async () => {
    seedWaitingManualAccount(ACCOUNT_A);
    mockGetClearingHouseState.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => usePerpsHomePnl());
    await elapseFallbackWindow();

    expect(mockGetClearingHouseState).toHaveBeenCalledTimes(1);
    expect(result.current.perpsPositionInfo.isLoading).toBe(false);
    expect(result.current.perpsPositionInfo.show).toBe(false);
  });

  it('never shows an unresolved account value after giving up', async () => {
    // Unified account whose clearinghouse frame landed but whose spot frame
    // never did: the available balance is still unknown.
    perpsStore.setState({
      ...initialState,
      currentPerpsAccount: ACCOUNT_A,
      userAbstraction: 'unifiedAccount' as never,
      userAbstractionReady: true,
      userAbstractionOwnerAddress: ACCOUNT_A.address,
      isUserDataReady: true,
      homePositionPnl: {
        pnl: 0,
        show: true,
        type: 'accountValue',
        accountValue: 7,
      },
    });
    mockGetSpotClearingHouseState.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => usePerpsHomePnl());
    expect(result.current.perpsPositionInfo.isLoading).toBe(true);
    await elapseFallbackWindow();

    expect(mockGetSpotClearingHouseState).toHaveBeenCalledTimes(1);
    expect(result.current.perpsPositionInfo.isLoading).toBe(false);
    expect(result.current.perpsPositionInfo.show).toBe(false);
  });

  it('starts waiting again for a different account after giving up', async () => {
    seedWaitingManualAccount(ACCOUNT_A);
    mockGetClearingHouseState.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => usePerpsHomePnl());
    await elapseFallbackWindow();
    expect(result.current.perpsPositionInfo.isLoading).toBe(false);

    act(() => {
      seedWaitingManualAccount(ACCOUNT_B);
    });

    expect(result.current.perpsPositionInfo.isLoading).toBe(true);
  });
});
