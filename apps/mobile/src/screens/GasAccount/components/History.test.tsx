import React from 'react';
import { FlatList, InteractionManager } from 'react-native';
import { act, render } from '@testing-library/react-native';

const mockLoadMore = jest.fn();

jest.mock('../hooks', () => ({
  useGasAccountHistory: () => ({
    loading: false,
    loadingMore: false,
    noMore: false,
    hasHistory: true,
    loadMore: mockLoadMore,
    txList: {
      rechargeList: [],
      withdrawList: [],
      list: [
        {
          id: 'history-1',
          tx_id: '0xtx',
          chain_id: 'eth',
          user_addr: '0xuser',
          create_at: 1,
          usd_value: 1,
          history_type: 'recharge',
        },
      ],
    },
  }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@rneui/themed', () => ({
  Skeleton: () => null,
}));

jest.mock('@/core/utils/startupDiagnostics', () => ({
  traceStartupDiagnostic: jest.fn(),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, isLight: true }),
}));

jest.mock('@/utils/number', () => ({
  formatUsdValue: (value: number) => `$${value}`,
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => () => ({}),
}));

jest.mock('@/utils/time', () => ({
  sinceTime: () => 'now',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

jest.mock('./GiftInfoModal', () => ({
  GiftInfoModal: () => null,
}));

const { GasAccountHistory } =
  require('./History') as typeof import('./History');

describe('GasAccountHistory', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('loads another page when the initial content cannot leave the end threshold', () => {
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation(callback => {
        callback();
        return { cancel: jest.fn() } as ReturnType<
          typeof InteractionManager.runAfterInteractions
        >;
      });

    const view = render(<GasAccountHistory />);
    const list = view.UNSAFE_getByType(FlatList);

    act(() => {
      list.props.onLayout?.({
        nativeEvent: { layout: { height: 494 } },
      });
      list.props.onContentSizeChange?.(0, 500);
      jest.runOnlyPendingTimers();
    });

    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });
});
