import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

let mockNetworks = ['1'];
const mockSyncNetworks = jest.fn();
const mockTransactions = jest.fn();
const mockMessages = jest.fn();
const mockSetNavigationOptions = jest.fn();

jest.mock('@/core/apis/safe', () => ({
  apisSafe: {
    getGnosisAllPendingTxs: (...args: unknown[]) => mockTransactions(...args),
    getGnosisAllPendingMessages: (...args: unknown[]) => mockMessages(...args),
  },
}));
jest.mock('@/hooks/gnosis/useGnosisNetworks', () => ({
  useGnosisNetworks: () => ({
    data: mockNetworks,
    syncNetworks: mockSyncNetworks,
  }),
}));
jest.mock('@/components/AppStatusBar', () => ({
  useSafeSetNavigationOptions: () => ({
    setNavigationOptions: mockSetNavigationOptions,
  }),
}));
jest.mock(
  '@/components/ScreenContainer/NormalScreenContainer',
  () => require('react-native').View,
);
jest.mock('@/components2024/PillSwitch', () => ({ PillsSwitch: () => null }));
jest.mock('@/hooks/theme', () => ({ useThemeColors: () => ({}) }));
jest.mock('@/utils/styles', () => ({
  createGetStyles: () => () => ({}),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useRoute: () => ({ params: { account: { address: '0xabc' } } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('./components/GnosisMessageQueue', () => ({
  GnosisMessageQueue: () => null,
}));
jest.mock('./components/GnosisTransactionQueue', () => ({
  GnosisTransactionQueue: ({
    refreshing,
    onRefresh,
  }: {
    refreshing: boolean;
    onRefresh(): void;
  }) => {
    const { createElement } = require('react');
    const { View, Text, Pressable } = require('react-native');
    return createElement(
      View,
      null,
      createElement(Text, { testID: 'refresh-state' }, String(refreshing)),
      createElement(Pressable, { testID: 'refresh', onPress: onRefresh }),
    );
  },
}));

import { clearCache } from 'ahooks';
import { GnosisQueueScreen } from './index';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Safe queue refresh (component unit)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clearCache();
    mockNetworks = ['1'];
    mockTransactions.mockResolvedValue({ total: 0, results: [] });
    mockMessages.mockResolvedValue({ total: 0, results: [] });
  });

  afterEach(() => {
    clearCache();
    // ahooks clears cached entries without canceling their expiry timers.
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('stops refreshing when a network change supersedes the manual pending requests', async () => {
    const sync = deferred<string[]>();
    const transactions = deferred<{ total: number; results: [] }>();
    const messages = deferred<{ total: number; results: [] }>();
    mockSyncNetworks.mockReturnValue(sync.promise);
    const screen = render(<GnosisQueueScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('refresh-state').props.children).toBe('false'),
    );
    mockTransactions.mockReturnValue(transactions.promise);
    mockMessages.mockReturnValue(messages.promise);
    act(() => jest.advanceTimersByTime(1));
    fireEvent.press(screen.getByTestId('refresh'));
    await act(async () => sync.resolve(['1', '10']));
    expect(mockTransactions).toHaveBeenCalledTimes(2);
    expect(mockMessages).toHaveBeenCalledTimes(2);

    // The network subscription publishes after the imperative refresh starts.
    // refreshDeps now replaces both still-pending ahooks requests.
    mockNetworks = ['1', '10'];
    screen.rerender(<GnosisQueueScreen />);
    expect(mockTransactions).toHaveBeenCalledTimes(3);
    expect(mockMessages).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('refresh-state').props.children).toBe('true');
    await act(async () => {
      transactions.resolve({ total: 0, results: [] });
      messages.resolve({ total: 0, results: [] });
    });
    await waitFor(() =>
      expect(screen.getByTestId('refresh-state').props.children).toBe('false'),
    );
    screen.unmount();
  });
});
