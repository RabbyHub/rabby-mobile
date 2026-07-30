import type { AccountsBalanceState } from '../store/balance';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve,
  };
};

const flushPendingTimers = async () => {
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};

describe('store/balance24h scene', () => {
  const mockComputeTotalBalance = jest.fn();
  const mockGetBalanceCacheAccounts = jest.fn();
  const mockGetSelectedBalanceAddressesSnapshot = jest.fn();
  const mockGetTop10MyAccounts = jest.fn();
  const mockGetBalance24hCache = jest.fn();
  const mockFetch24hBalance = jest.fn();
  const mockSetBalance24hCache = jest.fn();
  const mockPerfEmit = jest.fn();
  let mockBalanceValueMap: Record<
    string,
    {
      evmBalance: number;
      totalBalance: number;
    }
  >;
  let mockSelectedAddresses: string[];
  let mockHasResolvedSelection: boolean;
  let consoleErrorSpy: jest.SpyInstance;

  let scene24hBalanceModule: typeof import('../store/balance24h');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSelectedAddresses = [];
    mockHasResolvedSelection = false;
    mockBalanceValueMap = {
      '0xabc': {
        evmBalance: 100,
        totalBalance: 123,
      },
    };
    jest.doMock('react-native-haptic-feedback', () => ({
      trigger: jest.fn(),
    }));
    jest.doMock('@/core/utils/reexports', () => {
      const { create } = require('zustand');
      return {
        zCreate: create,
      };
    });
    jest.doMock('p-queue', () => {
      return jest.fn().mockImplementation(() => ({
        add: (fn: () => Promise<unknown>) => fn(),
        clear: jest.fn(),
        onIdle: jest.fn(() => Promise.resolve()),
      }));
    });
    jest.doMock('@/hooks/useCurve', () => ({
      formatSmallUsdValue: jest.fn(() => '$123'),
    }));
    jest.doMock('@/utils/number', () => ({
      formatUsdValue: jest.fn(() => '$1'),
    }));
    jest.doMock('@/core/apis/account', () => ({
      getTop10MyAccounts: (...args: unknown[]) =>
        mockGetTop10MyAccounts(...args),
    }));
    jest.doMock('@/core/services', () => ({
      keyringService: {
        on: jest.fn(),
        getAllAddresses: jest.fn(async () => []),
      },
    }));
    jest.doMock('@/core/utils/perf', () => ({
      perfEvents: {
        emit: (...args: unknown[]) => mockPerfEmit(...args),
      },
    }));
    jest.doMock('@/store/balance', () => ({
      __esModule: true,
      default: {
        computeTotalBalance: (...args: unknown[]) =>
          mockComputeTotalBalance(...args),
        getAddressValueMap: jest.fn(() => mockBalanceValueMap),
        useAddressValueMap: jest.fn(() => mockBalanceValueMap),
        subscribe: jest.fn(),
      },
      balanceAccountsStore: {
        getState: jest.fn(() => ({
          balance: mockGetBalanceCacheAccounts(),
          selectedAddresses: mockSelectedAddresses,
          hasResolvedSelection: mockHasResolvedSelection,
        })),
      },
      getSelectedBalanceAddressesSnapshot: () =>
        mockGetSelectedBalanceAddressesSnapshot(),
      accountsBalanceEvents: {
        on: jest.fn(),
      },
    }));
    jest.doMock('@/utils/24hBalanceCache', () => ({
      getBalance24hCache: (...args: unknown[]) =>
        mockGetBalance24hCache(...args),
      fetch24hBalance: (...args: unknown[]) => mockFetch24hBalance(...args),
      setBalance24hCache: (...args: unknown[]) =>
        mockSetBalance24hCache(...args),
    }));

    mockGetTop10MyAccounts.mockResolvedValue({
      top10Addresses: [],
    });
    mockGetSelectedBalanceAddressesSnapshot.mockReturnValue([]);
    mockComputeTotalBalance.mockReturnValue({
      total: 123,
      totalEvm: 100,
    });
    mockGetBalanceCacheAccounts.mockReturnValue({
      '0xabc': {
        address: '0xabc',
        balance: 123,
        evmBalance: 100,
      },
    });
    mockGetBalance24hCache.mockReturnValue(null);
    mockFetch24hBalance.mockResolvedValue({
      total_usd_value: 90,
      data: {
        total_usd_value: 90,
      },
      updateTime: 1,
    });

    scene24hBalanceModule = require('../store/balance24h');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  it('prefers addresses from balanceAccounts during refresh', async () => {
    const staleBalanceAccounts: AccountsBalanceState['balance'] = {
      '0xabc': {
        address: '0xabc',
        balance: 0,
        evmBalance: 0,
      },
    };

    await scene24hBalanceModule.scene24hBalanceStore.refresh24hAssets({
      balanceAccounts: staleBalanceAccounts,
      reason: 'manual_refresh',
    });

    expect(mockGetTop10MyAccounts).not.toHaveBeenCalled();
    expect(mockFetch24hBalance).toHaveBeenCalledWith('0xabc');
    expect(mockComputeTotalBalance).toHaveBeenCalledWith(
      ['0xabc'],
      mockGetBalanceCacheAccounts(),
    );
  });

  it('keeps combined change data available when only part of addresses have 24h values', async () => {
    mockBalanceValueMap = {
      '0xabc': {
        evmBalance: 100,
        totalBalance: 120,
      },
      '0xdef': {
        evmBalance: 50,
        totalBalance: 70,
      },
    };
    mockGetBalanceCacheAccounts.mockReturnValue({
      '0xabc': {
        address: '0xabc',
        balance: 120,
        evmBalance: 100,
      },
      '0xdef': {
        address: '0xdef',
        balance: 70,
        evmBalance: 50,
      },
    });
    mockComputeTotalBalance.mockReturnValue({
      total: 190,
      totalEvm: 150,
    });
    mockGetBalance24hCache.mockImplementation((address: string) => {
      if (address === '0xabc') {
        return {
          data: {
            total_usd_value: 90,
          },
          updateTime: 1,
          isExpired: false,
        };
      }

      return null;
    });
    mockFetch24hBalance.mockRejectedValueOnce(new Error('network error'));

    await scene24hBalanceModule.scene24hBalanceStore.refresh24hAssets({
      addresses: ['0xabc', '0xdef'],
      reason: 'manual_refresh',
    });
    await flushPendingTimers();

    expect(mockPerfEmit).toHaveBeenCalledWith(
      'SCENE_24H_BALANCE_UPDATED',
      expect.objectContaining({
        scene: 'Home',
        combinedData: expect.objectContaining({
          rawNetWorth: 190,
          rawChange: 10,
          changePercent: '11.11%',
          isLoss: false,
        }),
      }),
    );
  });

  it('does not let a stale caller replace the resolved post-delete selection', async () => {
    const preDeleteAddresses = ['0xdeleted', '0xretained'];
    const postDeleteAddresses = ['0xretained', '0xpromoted'];
    mockHasResolvedSelection = true;
    mockBalanceValueMap = {
      '0xdeleted': {
        evmBalance: 20,
        totalBalance: 25,
      },
      '0xretained': {
        evmBalance: 80,
        totalBalance: 100,
      },
      '0xpromoted': {
        evmBalance: 40,
        totalBalance: 50,
      },
    };
    mockGetBalanceCacheAccounts.mockReturnValue({
      '0xdeleted': {
        address: '0xdeleted',
        balance: 25,
        evmBalance: 20,
      },
      '0xretained': {
        address: '0xretained',
        balance: 100,
        evmBalance: 80,
      },
      '0xpromoted': {
        address: '0xpromoted',
        balance: 50,
        evmBalance: 40,
      },
    });
    mockFetch24hBalance.mockImplementation(async (address: string) => {
      const totalUsdValue =
        address === '0xdeleted' ? 20 : address === '0xretained' ? 90 : 40;

      return {
        total_usd_value: totalUsdValue,
        data: {
          total_usd_value: totalUsdValue,
        },
        updateTime: 1,
      };
    });

    mockSelectedAddresses = preDeleteAddresses;
    await scene24hBalanceModule.scene24hBalanceStore.refresh24hAssets({
      addresses: preDeleteAddresses,
      reason: 'manual_refresh',
    });
    await flushPendingTimers();

    mockSelectedAddresses = postDeleteAddresses;
    await scene24hBalanceModule.scene24hBalanceStore.refresh24hAssets({
      addresses: postDeleteAddresses,
      reason: 'selection_changed',
    });
    await flushPendingTimers();

    mockFetch24hBalance.mockClear();
    await scene24hBalanceModule.scene24hBalanceStore.refresh24hAssets({
      addresses: preDeleteAddresses,
      reason: 'manual_refresh',
    });
    await flushPendingTimers();

    const state = scene24hBalanceModule.scene24hBalanceStore.getState();
    expect(state.addresses.Home).toEqual([...postDeleteAddresses].sort());
    expect(state.sceneLoading.Home).toBe(false);
    expect(state.sceneComputing.Home).toBe(false);
    expect(state.combinedData.Home).toEqual(
      expect.objectContaining({
        rawNetWorth: 150,
        rawChange: -10,
        changePercent: '7.69%',
        isLoss: true,
      }),
    );
    expect(mockFetch24hBalance).not.toHaveBeenCalledWith('0xdeleted');
  });

  it('keeps an explicitly resolved empty selection after deleting the last address', async () => {
    mockSelectedAddresses = [];
    mockHasResolvedSelection = true;

    await scene24hBalanceModule.scene24hBalanceStore.refresh24hAssets({
      addresses: ['0xdeleted'],
      reason: 'manual_refresh',
    });
    await flushPendingTimers();

    const state = scene24hBalanceModule.scene24hBalanceStore.getState();
    expect(state.addresses.Home).toEqual([]);
    expect(state.sceneLoading.Home).toBe(false);
    expect(state.sceneComputing.Home).toBe(false);
    expect(mockGetTop10MyAccounts).not.toHaveBeenCalled();
    expect(mockFetch24hBalance).not.toHaveBeenCalled();
  });

  it('keeps the post-delete address set when an older fallback refresh resolves last', async () => {
    const preDeleteAddresses = ['0xdeleted', '0xretained'];
    const postDeleteAddresses = ['0xretained', '0xpromoted'];
    const staleAddressLookup = createDeferred<{
      top10Addresses: string[];
    }>();
    mockGetTop10MyAccounts.mockReturnValueOnce(staleAddressLookup.promise);
    mockBalanceValueMap = {
      '0xretained': {
        evmBalance: 80,
        totalBalance: 100,
      },
      '0xpromoted': {
        evmBalance: 40,
        totalBalance: 50,
      },
    };
    mockGetBalanceCacheAccounts.mockReturnValue({
      '0xretained': {
        address: '0xretained',
        balance: 100,
        evmBalance: 80,
      },
      '0xpromoted': {
        address: '0xpromoted',
        balance: 50,
        evmBalance: 40,
      },
    });
    mockFetch24hBalance.mockImplementation(async (address: string) => {
      const totalUsdValue = address === '0xretained' ? 90 : 40;

      return {
        total_usd_value: totalUsdValue,
        data: {
          total_usd_value: totalUsdValue,
        },
        updateTime: 1,
      };
    });

    const staleRefresh =
      scene24hBalanceModule.scene24hBalanceStore.refresh24hAssets({
        reason: 'manual_refresh',
      });
    await Promise.resolve();

    await scene24hBalanceModule.scene24hBalanceStore.refresh24hAssets({
      addresses: postDeleteAddresses,
      reason: 'selection_changed',
    });
    await flushPendingTimers();

    expect(
      scene24hBalanceModule.scene24hBalanceStore.getState().addresses.Home,
    ).toEqual([...postDeleteAddresses].sort());

    staleAddressLookup.resolve({
      top10Addresses: preDeleteAddresses,
    });
    await staleRefresh;
    await flushPendingTimers();

    const state = scene24hBalanceModule.scene24hBalanceStore.getState();
    expect(state.addresses.Home).toEqual([...postDeleteAddresses].sort());
    expect(state.sceneLoading.Home).toBe(false);
    expect(state.sceneComputing.Home).toBe(false);
    expect(state.combinedData.Home).toEqual(
      expect.objectContaining({
        rawNetWorth: 150,
        rawChange: -10,
        changePercent: '7.69%',
        isLoss: true,
      }),
    );
    expect(mockFetch24hBalance).not.toHaveBeenCalledWith('0xdeleted');
  });
});
