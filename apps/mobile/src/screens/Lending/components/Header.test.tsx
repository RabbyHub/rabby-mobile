import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
} from '@testing-library/react-native';
import { LendingHistoryHeader } from './Header';

const mockFetchLendingData = jest.fn();
const mockUpdateSpecificProtocol = jest.fn();
const mockNavigate = jest.fn();
const mockListeners = new Set<() => unknown>();
jest.mock('@/assets2024/icons/common/IconHistoryCC.svg', () => () => null);
let mockAddress: string | undefined = '0xaccount-a';
let mockMarketKey = 'proto_mainnet_v3';
let mockServerId: string | undefined = 'eth';
let mockReady = true;
let mockPendingCount = 0;
let mockSuccessCount = 0;

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/screens/Bridge/components/PendingTx', () => ({
  __esModule: true,
  default: ({ number, onClick }: { number: number; onClick: () => void }) =>
    require('react').createElement(
      require('react-native').Text,
      { onPress: onClick },
      `Pending ${number}`,
    ),
}));
jest.mock('@/utils/navigation', () => ({
  naviPush: (...args: unknown[]) => mockNavigate(...args),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('ahooks', () => ({ useInterval: () => {} }));
jest.mock('@/utils/events', () => ({
  EVENTS: { RELOAD_TX: 'reload' },
  eventBus: {
    addListener: (_event: string, callback: () => unknown) =>
      mockListeners.add(callback),
    removeListener: (_event: string, callback: () => unknown) =>
      mockListeners.delete(callback),
  },
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  getTransactionHistoryListSnapshot: () => ({
    pendings: Array.from({ length: mockPendingCount }, () => ({
      chainId: 1,
      customActionInfo: {
        customAction: require('@/screens/Transaction/components/type')
          .CUSTOM_HISTORY_ACTION.LENDING,
      },
    })),
  }),
  getTransactionHistoryLendingSuccessListSnapshot: () =>
    Array.from({ length: mockSuccessCount }, () => ({})),
}));
jest.mock('@/utils/chain', () => ({ findChain: () => ({ isTestnet: false }) }));
jest.mock('@/hooks/accountsSwitcher', () => ({
  useSceneAccountInfo: () => ({
    finalSceneCurrentAccount: mockAddress
      ? { address: mockAddress }
      : undefined,
  }),
}));
jest.mock('../hooks', () => ({
  useRefreshHistoryId: () => ({ refreshHistoryId: 0 }),
  useSelectedMarket: () => ({
    marketKey: mockMarketKey,
    chainInfo: mockServerId ? { serverId: mockServerId } : undefined,
  }),
  apisLending: {
    fetchLendingData: (...args: unknown[]) => mockFetchLendingData(...args),
  },
}));
jest.mock('@/store/protocols', () => ({
  __esModule: true,
  default: {
    getState: () => ({ updateSpecificProtocol: mockUpdateSpecificProtocol }),
  },
}));
jest.mock('@/core/serviceApi/transactionHistoryHooks', () => ({
  useTransactionHistoryServiceReady: () => mockReady,
  withTransactionHistoryService: (Component: unknown) => Component,
}));

function reloadHistory() {
  act(() => {
    mockListeners.forEach(listener => listener());
  });
}

describe('Lending history pending completion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAddress = '0xaccount-a';
    mockMarketKey = 'proto_mainnet_v3';
    mockServerId = 'eth';
    mockReady = true;
    mockPendingCount = 0;
    mockSuccessCount = 0;
  });

  afterEach(async () => {
    await cleanupAsync();
    expect(mockListeners.size).toBe(0);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not refresh on an initially empty history or while transactions remain pending', () => {
    const screen = render(<LendingHistoryHeader />);
    act(() => jest.advanceTimersByTime(200));
    expect(mockFetchLendingData).not.toHaveBeenCalled();

    mockPendingCount = 2;
    reloadHistory();
    expect(screen.getByText('Pending 2')).toBeTruthy();
    act(() => jest.advanceTimersByTime(200));
    expect(mockFetchLendingData).not.toHaveBeenCalled();
    expect(mockUpdateSpecificProtocol).not.toHaveBeenCalled();
  });

  it.each([
    ['proto_mainnet_v3', 'eth', 'aave3'],
    ['proto_plasma_v3', 'plasma', 'plasma_aave3'],
  ])(
    'refreshes %s and its protocol 200ms after pending clears',
    (market, chain, protocol) => {
      mockMarketKey = market;
      mockServerId = chain;
      mockPendingCount = 1;
      const screen = render(<LendingHistoryHeader />);
      expect(screen.getByText('Pending 1')).toBeTruthy();
      mockPendingCount = 0;
      reloadHistory();
      act(() => jest.advanceTimersByTime(199));
      expect(mockFetchLendingData).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(1));

      expect(mockFetchLendingData).toHaveBeenCalledTimes(1);
      expect(mockFetchLendingData).toHaveBeenCalledWith({
        accountAddress: '0xaccount-a',
        marketKey: market,
        ignoreLoading: true,
      });
      expect(mockUpdateSpecificProtocol).toHaveBeenCalledWith(
        '0xaccount-a',
        protocol,
        chain,
      );
      reloadHistory();
      act(() => jest.advanceTimersByTime(200));
      expect(mockFetchLendingData).toHaveBeenCalledTimes(1);
    },
  );

  it('captures the account and market when completion is observed, not at timer execution', () => {
    mockPendingCount = 1;
    const screen = render(<LendingHistoryHeader />);
    mockAddress = '0xaccount-b';
    mockMarketKey = 'proto_plasma_v3';
    mockServerId = 'plasma';
    screen.rerender(<LendingHistoryHeader />);
    mockPendingCount = 0;
    reloadHistory();
    mockAddress = '0xaccount-c';
    mockMarketKey = 'proto_mainnet_v3';
    mockServerId = 'eth';
    screen.rerender(<LendingHistoryHeader />);
    act(() => jest.advanceTimersByTime(200));

    expect(mockFetchLendingData).toHaveBeenCalledTimes(1);
    expect(mockFetchLendingData).toHaveBeenCalledWith({
      accountAddress: '0xaccount-b',
      marketKey: 'proto_plasma_v3',
      ignoreLoading: true,
    });
    expect(mockUpdateSpecificProtocol).toHaveBeenCalledWith(
      '0xaccount-b',
      'plasma_aave3',
      'plasma',
    );
  });

  it('does not update a protocol for a market without a mapping', () => {
    mockMarketKey = 'unknown-market';
    mockPendingCount = 1;
    render(<LendingHistoryHeader />);
    mockPendingCount = 0;
    reloadHistory();
    act(() => jest.advanceTimersByTime(200));
    expect(mockFetchLendingData).toHaveBeenCalledTimes(1);
    expect(mockUpdateSpecificProtocol).not.toHaveBeenCalled();
  });

  it('keeps the existing pending history action', () => {
    mockPendingCount = 1;
    const screen = render(<LendingHistoryHeader />);
    fireEvent.press(screen.getByText('Pending 1'));
    expect(mockNavigate).toHaveBeenCalledWith('StackTransaction', {
      screen: 'LendingHistory',
      params: {},
    });
  });

  it('does not interpret changing accounts as a completed pending transaction', () => {
    mockPendingCount = 1;
    const screen = render(<LendingHistoryHeader />);
    mockAddress = '0xaccount-b';
    mockPendingCount = 0;
    screen.rerender(<LendingHistoryHeader />);
    act(() => jest.advanceTimersByTime(200));
    expect(mockFetchLendingData).not.toHaveBeenCalled();
    expect(mockUpdateSpecificProtocol).not.toHaveBeenCalled();
  });

  it('does not consume another mounted header instance pending count', () => {
    mockPendingCount = 1;
    const first = render(<LendingHistoryHeader />);
    mockPendingCount = 0;
    const second = render(<LendingHistoryHeader />);
    act(() => jest.advanceTimersByTime(200));
    expect(mockFetchLendingData).not.toHaveBeenCalled();
    second.unmount();
    reloadHistory();
    act(() => jest.advanceTimersByTime(200));
    expect(mockFetchLendingData).toHaveBeenCalledTimes(1);
    first.unmount();
  });

  it('does not treat a not-ready service or absent account as an empty snapshot', () => {
    mockPendingCount = 1;
    const screen = render(<LendingHistoryHeader />);
    mockReady = false;
    mockPendingCount = 0;
    screen.rerender(<LendingHistoryHeader />);
    reloadHistory();
    act(() => jest.advanceTimersByTime(200));
    expect(mockFetchLendingData).not.toHaveBeenCalled();
    mockAddress = undefined;
    mockReady = true;
    screen.rerender(<LendingHistoryHeader />);
    reloadHistory();
    act(() => jest.advanceTimersByTime(200));
    expect(mockFetchLendingData).not.toHaveBeenCalled();
  });
});
