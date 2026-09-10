import type { Account } from '@/core/startupServices/preference';
import {
  UserAbstractionResp,
  type ClearinghouseState,
} from '@rabby-wallet/hyperliquid-sdk';

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
  fetchHomePerpsSnapshotHttp,
  initialState,
  isPerpsUserAbstractionModeKnown,
  perpsStore,
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

describe('isPerpsUserAbstractionModeKnown', () => {
  it('is false without a current account', () => {
    expect(
      isPerpsUserAbstractionModeKnown({
        currentPerpsAccount: null,
        userAbstractionReady: true,
        userAbstractionCachedAddress: ACCOUNT_A.address,
      }),
    ).toBe(false);
  });

  it('is false when the mode is neither resolved nor cached for this address', () => {
    expect(
      isPerpsUserAbstractionModeKnown({
        currentPerpsAccount: ACCOUNT_A,
        userAbstractionReady: false,
        userAbstractionCachedAddress: ACCOUNT_B.address,
      }),
    ).toBe(false);
  });

  it('treats a cached mode for the current address as known', () => {
    expect(
      isPerpsUserAbstractionModeKnown({
        currentPerpsAccount: ACCOUNT_A,
        userAbstractionReady: false,
        userAbstractionCachedAddress: ACCOUNT_A.address.toUpperCase(),
      }),
    ).toBe(true);
  });

  it('treats a network-resolved mode as known', () => {
    expect(
      isPerpsUserAbstractionModeKnown({
        currentPerpsAccount: ACCOUNT_A,
        userAbstractionReady: true,
        userAbstractionCachedAddress: null,
      }),
    ).toBe(true);
  });
});

describe('fetchHomePerpsSnapshotHttp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    perpsStore.setState({ ...initialState });
  });

  it('publishes the clearinghouse snapshot when user data never arrived', async () => {
    perpsStore.setState({
      currentPerpsAccount: ACCOUNT_A,
      isUserDataReady: false,
      userAbstraction: UserAbstractionResp.default,
      userAbstractionReady: true,
      userAbstractionOwnerAddress: ACCOUNT_A.address,
    });
    mockGetClearingHouseState.mockResolvedValue(
      buildClearinghouseState('12.5', 10),
    );

    await fetchHomePerpsSnapshotHttp(ACCOUNT_A.address);

    expect(mockGetClearingHouseState).toHaveBeenCalledWith(
      ACCOUNT_A.address,
      undefined,
    );
    expect(mockGetSpotClearingHouseState).not.toHaveBeenCalled();
    const state = perpsStore.getState();
    expect(state.isUserDataReady).toBe(true);
    expect(state.homePositionPnl).toEqual({
      pnl: 0,
      show: true,
      type: 'accountValue',
      accountValue: 12.5,
    });
  });

  it('also pulls spot state for spot-collateral modes', async () => {
    perpsStore.setState({
      currentPerpsAccount: ACCOUNT_A,
      isUserDataReady: false,
      isSpotStateReady: false,
      userAbstraction: UserAbstractionResp.unifiedAccount,
    });
    mockGetClearingHouseState.mockResolvedValue(
      buildClearinghouseState('0', 20),
    );
    mockGetSpotClearingHouseState.mockResolvedValue({
      balances: [
        { coin: 'USDC', token: 0, total: '5', hold: '0', entryNtl: '0' },
      ],
    });

    await fetchHomePerpsSnapshotHttp(ACCOUNT_A.address);

    expect(mockGetSpotClearingHouseState).toHaveBeenCalledWith(
      ACCOUNT_A.address,
    );
    const state = perpsStore.getState();
    expect(state.isUserDataReady).toBe(true);
    expect(state.isSpotStateReady).toBe(true);
    expect(state.spotState.balancesMap.USDC?.available).toBe('5');
  });

  it('pulls spot state while the abstraction mode is still unknown', async () => {
    perpsStore.setState({
      currentPerpsAccount: ACCOUNT_A,
      isUserDataReady: true,
      isSpotStateReady: false,
      userAbstraction: UserAbstractionResp.default,
      userAbstractionReady: false,
      userAbstractionCachedAddress: null,
    });
    mockGetSpotClearingHouseState.mockResolvedValue({
      balances: [
        { coin: 'USDC', token: 0, total: '9', hold: '0', entryNtl: '0' },
      ],
    });

    await fetchHomePerpsSnapshotHttp(ACCOUNT_A.address);

    expect(mockGetClearingHouseState).not.toHaveBeenCalled();
    expect(mockGetSpotClearingHouseState).toHaveBeenCalledWith(
      ACCOUNT_A.address,
    );
    expect(perpsStore.getState().isSpotStateReady).toBe(true);
  });

  it('skips spot state for a cached manual mode', async () => {
    perpsStore.setState({
      currentPerpsAccount: ACCOUNT_A,
      isUserDataReady: true,
      isSpotStateReady: false,
      userAbstraction: UserAbstractionResp.default,
      userAbstractionReady: false,
      userAbstractionCachedAddress: ACCOUNT_A.address,
    });

    await fetchHomePerpsSnapshotHttp(ACCOUNT_A.address);

    expect(mockGetClearingHouseState).not.toHaveBeenCalled();
    expect(mockGetSpotClearingHouseState).not.toHaveBeenCalled();
  });

  it('skips requests whose data already resolved', async () => {
    perpsStore.setState({
      currentPerpsAccount: ACCOUNT_A,
      isUserDataReady: true,
      isSpotStateReady: true,
      userAbstraction: UserAbstractionResp.unifiedAccount,
    });

    await fetchHomePerpsSnapshotHttp(ACCOUNT_A.address);

    expect(mockGetClearingHouseState).not.toHaveBeenCalled();
    expect(mockGetSpotClearingHouseState).not.toHaveBeenCalled();
  });

  it('resolves even when every request fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    perpsStore.setState({
      currentPerpsAccount: ACCOUNT_A,
      isUserDataReady: false,
      isSpotStateReady: false,
      userAbstraction: UserAbstractionResp.portfolioMargin,
    });
    mockGetClearingHouseState.mockRejectedValue(new Error('offline'));
    mockGetSpotClearingHouseState.mockRejectedValue(new Error('offline'));

    await expect(
      fetchHomePerpsSnapshotHttp(ACCOUNT_A.address),
    ).resolves.toBeUndefined();

    const state = perpsStore.getState();
    expect(state.isUserDataReady).toBe(false);
    expect(state.isSpotStateReady).toBe(false);
    consoleError.mockRestore();
  });

  it('ignores an address that is no longer current', async () => {
    perpsStore.setState({
      currentPerpsAccount: ACCOUNT_B,
      isUserDataReady: false,
    });

    await fetchHomePerpsSnapshotHttp(ACCOUNT_A.address);

    expect(mockGetClearingHouseState).not.toHaveBeenCalled();
    expect(mockGetSpotClearingHouseState).not.toHaveBeenCalled();
  });
});
