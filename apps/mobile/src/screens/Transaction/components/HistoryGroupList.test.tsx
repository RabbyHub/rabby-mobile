import React from 'react';
import { FlatList, Platform, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import type { HistoryDisplayItem } from '@/types/history';
import { HistoryList } from './HistoryGroupList';

// Component coverage: the list footer, empty-state, date-row and clipping
// contracts only;
// rows, skeletons and the empty illustration are presentation stubs.
jest.mock('../utils/bridgeHistory', () => ({
  isBridgeHistoryRow: (item: { kind?: string } | null | undefined) =>
    !!item && item.kind === 'bridge',
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-gesture-handler', () => ({
  RefreshControl: require('react-native').RefreshControl,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@/utils/time', () => ({
  formatTimestamp: (time: number) => `day ${new Date(time).getDate()}`,
}));
jest.mock('../hook', () => ({
  useGetCexList: () => ({ getCexInfoByAddress: jest.fn() }),
}));
jest.mock('./HistoryItem', () => ({
  HistoryItem: ({ data }: { data: { id: string } }) => {
    const { Text } = require('react-native');
    return <Text>{data.id}</Text>;
  },
}));
jest.mock('@/screens/TransactionRecord/components/TransactionItem2025', () => ({
  TransactionItem: () => null,
}));
jest.mock('./SkeletonCard', () => ({
  SkeletonCard: () => {
    const { Text } = require('react-native');
    return <Text>skeleton</Text>;
  },
}));
jest.mock('./Empty', () => ({
  Empty: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

const NO_MORE = 'No more transactions in the last 90 days.';

const row = (id: string, time_at = 100) =>
  ({
    id,
    address: '0xa',
    chain: 'eth',
    time_at,
    project_item: null,
  } as unknown as HistoryDisplayItem);

// local time, like the grouping itself
const at = (day: number, hour: number) =>
  new Date(2026, 0, day, hour).getTime() / 1000;
const twoDays = [
  row('tx-1', at(2, 12)),
  row('tx-2', at(2, 8)),
  row('tx-3', at(1, 12)),
];

describe('HistoryList no-more footer', () => {
  it('shows the footer under the last row', () => {
    render(
      <HistoryList
        list={[row('tx-1'), row('tx-2')]}
        firstFetchDone
        noMoreText={NO_MORE}
      />,
    );

    expect(screen.getByText('tx-2')).toBeTruthy();
    expect(screen.getByText(NO_MORE)).toBeTruthy();
  });

  it('shows the 90-day empty state instead of the footer when there are no rows', () => {
    render(<HistoryList list={[]} firstFetchDone noMoreText={NO_MORE} />);

    expect(
      screen.getByText('page.activities.signedTx.empty.titleInLast90Days'),
    ).toBeTruthy();
    expect(screen.queryByText(NO_MORE)).toBeNull();
  });

  it('drops the 90-day wording for API-backed lists', () => {
    render(<HistoryList list={[]} firstFetchDone isNeedFetchFromApi />);

    expect(
      screen.getByText('page.activities.signedTx.empty.titleNoTransactions'),
    ).toBeTruthy();
  });

  it('hides the footer while the next page is loading', () => {
    render(
      <HistoryList
        list={[row('tx-1')]}
        firstFetchDone
        loadingMore
        noMoreText={NO_MORE}
      />,
    );

    expect(screen.getByText('skeleton')).toBeTruthy();
    expect(screen.queryByText(NO_MORE)).toBeNull();
  });
});

describe('HistoryList date rows', () => {
  it("shows one date per day, ahead of that day's rows", () => {
    render(<HistoryList list={twoDays} firstFetchDone />);

    expect(
      screen.getAllByText(/^(day|tx)/).map(node => node.props.children),
    ).toEqual(['day 2', 'tx-1', 'tx-2', 'day 1', 'tx-3']);
    expect(
      screen.UNSAFE_getByType(FlatList).props.stickyHeaderIndices,
    ).toBeUndefined();
  });

  it('pins the dates once a background is given', () => {
    render(
      <HistoryList
        list={twoDays}
        firstFetchDone
        stickyDateBackgroundColor="#fff"
      />,
    );

    expect(screen.UNSAFE_getByType(FlatList).props.stickyHeaderIndices).toEqual(
      [0, 3],
    );
  });

  it('skips the list header when pinning the dates', () => {
    render(
      <HistoryList
        list={twoDays}
        firstFetchDone
        stickyDateBackgroundColor="#fff"
        ListHeaderComponent={<View />}
      />,
    );

    expect(screen.UNSAFE_getByType(FlatList).props.stickyHeaderIndices).toEqual(
      [1, 4],
    );
  });

  it('reports only transactions as visible', () => {
    const onVisibleItemsChange = jest.fn();
    render(
      <HistoryList
        list={twoDays}
        firstFetchDone
        onVisibleItemsChange={onVisibleItemsChange}
      />,
    );

    const { data, onViewableItemsChanged } =
      screen.UNSAFE_getByType(FlatList).props;
    onViewableItemsChanged({
      viewableItems: data.map((item: unknown) => ({ item })),
      changed: [],
    });

    expect(onVisibleItemsChange).toHaveBeenCalledWith(twoDays);
  });
});

// React Native switches clipping off natively once an Android list has sticky
// headers, and that switch on a mounted list loses rows and crashes.
describe('HistoryList subview clipping', () => {
  const clipping = () =>
    screen.UNSAFE_getByType(FlatList).props.removeClippedSubviews;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is off on Android before the first pinned date arrives, and stays off', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { rerender } = render(
      <HistoryList list={[]} firstFetchDone stickyDateBackgroundColor="#fff" />,
    );
    expect(clipping()).toBe(false);

    rerender(
      <HistoryList
        list={twoDays}
        firstFetchDone
        stickyDateBackgroundColor="#fff"
      />,
    );
    expect(clipping()).toBe(false);
  });

  it('stays on for Android lists without pinned dates', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    render(<HistoryList list={twoDays} firstFetchDone />);

    expect(clipping()).toBe(true);
  });

  it('stays on for iOS, where pinned dates do not switch it', () => {
    render(
      <HistoryList
        list={twoDays}
        firstFetchDone
        stickyDateBackgroundColor="#fff"
      />,
    );

    expect(clipping()).toBe(true);
  });
});
