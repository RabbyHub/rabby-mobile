import React from 'react';
import { FlatList } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { GasAccountHistory } from './History';

jest.mock('@/utils/number', () => ({
  formatUsdValue: (value: number) => String(value),
}));
jest.mock('@rneui/themed', () => ({ Skeleton: 'Skeleton' }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, isLight: true }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => () => ({}),
}));
jest.mock('./GiftInfoModal', () => ({ GiftInfoModal: 'GiftInfoModal' }));
jest.mock('@/components/Typography', () => ({ Text: 'Text' }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

type HistoryState = React.ComponentProps<
  typeof GasAccountHistory
>['historyState'];

const createHistoryState = (
  overrides: Partial<HistoryState> = {},
): HistoryState => ({
  loading: false,
  refreshing: true,
  historyReady: false,
  txList: {
    list: [],
    rechargeList: [],
    withdrawList: [],
    totalCount: 1,
  },
  loadingMore: false,
  loadMore: jest.fn(),
  noMore: false,
  hasHistory: true,
  hasPendingHistory: false,
  ...overrides,
});

const renderRefreshTransition = (
  historyReady: boolean,
  {
    contentHeight = 120,
    scrollOffset = 0,
  }: { contentHeight?: number; scrollOffset?: number } = {},
) => {
  const loadMore = jest.fn();
  const { UNSAFE_getByType, rerender } = render(
    <GasAccountHistory historyState={createHistoryState({ loadMore })} />,
  );
  const list = UNSAFE_getByType(FlatList);

  act(() => {
    list.props.onLayout({ nativeEvent: { layout: { height: 100 } } });
    list.props.onContentSizeChange(0, contentHeight);
    list.props.onScroll({
      nativeEvent: { contentOffset: { y: scrollOffset } },
    });
  });

  rerender(
    <GasAccountHistory
      historyState={createHistoryState({
        loadMore,
        refreshing: false,
        historyReady,
      })}
    />,
  );

  return loadMore;
};

it('loads more after a successful refresh within the end threshold', () => {
  expect(renderRefreshTransition(true)).toHaveBeenCalledTimes(1);
});

it('loads more after refresh when a long list is scrolled near the end', () => {
  expect(
    renderRefreshTransition(true, {
      contentHeight: 300,
      scrollOffset: 150,
    }),
  ).toHaveBeenCalledTimes(1);
});

it('does not load more after a failed refresh', () => {
  const loadMore = renderRefreshTransition(false);

  expect(loadMore).not.toHaveBeenCalled();
});
