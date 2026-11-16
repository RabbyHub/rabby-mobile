import React from 'react';
import { act, render } from '@testing-library/react-native';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { useMemeHoldingsStore } from '@/screens/MemeCoin/data/memeHoldingsStore';
import { MemeCoinBalance } from './MemeCoinBalance';

const mockGetMemeUserTokenList = jest.fn();
const mockScheduleStartupTask = jest.fn();
let mockAddress: string | undefined = '0xABC';

jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/components/Typography', () => ({
  Text: jest.requireActual('react-native').Text,
}));
jest.mock('@/components2024/CustomSkeleton', () => ({
  CustomSkeleton: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>skeleton</Text>;
  },
}));
jest.mock('@/core/chaintable', () => ({
  chaintable: {
    getMemeUserTokenList: (address: string) =>
      mockGetMemeUserTokenList(address),
  },
}));
jest.mock('@/core/utils/startupScheduler', () => ({
  scheduleStartupTask: (...args: unknown[]) => mockScheduleStartupTask(...args),
}));
jest.mock('@/hooks/accountsSwitcher', () => ({
  useSceneAccountInfo: () => ({
    finalSceneCurrentAccount: mockAddress ? { address: mockAddress } : null,
  }),
}));
jest.mock('@/screens/MemeCoin/ui/formatBalance', () => ({
  formatMemeBalanceUsd: (usd: number) => `$${usd}`,
}));
jest.mock('../hooks/useHideBalance', () => ({
  BALANCE_HIDE_TYPE: { HIDE: 'HIDE' },
  useHideBalance: () => ['SHOW'],
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('MemeCoinBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddress = '0xABC';
    useMemeHoldingsStore.setState({ byAddress: {}, failedByAddress: {} });
    mockScheduleStartupTask.mockImplementation((task: () => void) => {
      task();
      return { cancel: jest.fn() };
    });
  });

  it('loads on the same startup stage as the Perps entry', async () => {
    mockGetMemeUserTokenList.mockResolvedValue({
      positions: [],
      total_usd_value: 0,
    });
    render(<MemeCoinBalance />);
    await act(async () => {});
    expect(mockScheduleStartupTask).toHaveBeenCalledWith(
      expect.any(Function),
      STARTUP_TASKS.homeMemeHoldingsWarmup,
    );
    expect(STARTUP_TASKS.homeMemeHoldingsWarmup.stage).toBe(
      STARTUP_TASKS.perpsHomePositionSubscription.stage,
    );
    expect(STARTUP_TASKS.homeMemeHoldingsWarmup.delayMs).toBeUndefined();
  });

  it('shows a skeleton until the balance arrives', async () => {
    const request = deferred<{ positions: never[]; total_usd_value: number }>();
    mockGetMemeUserTokenList.mockReturnValue(request.promise);
    const { getByText, queryByText } = render(<MemeCoinBalance />);
    getByText('skeleton');
    expect(mockGetMemeUserTokenList).toHaveBeenCalledWith('0xabc');

    await act(async () => {
      request.resolve({ positions: [], total_usd_value: 2456 });
    });
    getByText('$2456');
    expect(queryByText('skeleton')).toBeNull();
  });

  it('drops the skeleton when the request fails', async () => {
    const request = deferred<never>();
    mockGetMemeUserTokenList.mockReturnValue(request.promise);
    const { queryByText } = render(<MemeCoinBalance />);

    await act(async () => {
      request.reject(new Error('network'));
    });
    expect(queryByText('skeleton')).toBeNull();
  });

  it('shows nothing for an empty balance', async () => {
    mockGetMemeUserTokenList.mockResolvedValue({
      positions: [],
      total_usd_value: 0,
    });
    const { toJSON } = render(<MemeCoinBalance />);
    await act(async () => {});
    expect(toJSON()).toBeNull();
  });

  it('shows no skeleton without an account', () => {
    mockAddress = undefined;
    const { toJSON } = render(<MemeCoinBalance />);
    expect(toJSON()).toBeNull();
    expect(mockScheduleStartupTask).not.toHaveBeenCalled();
  });
});
