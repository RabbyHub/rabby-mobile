import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { HistoryDisplayItem } from '@/types/history';
import { HistoryList } from './HistoryGroupList';

// Component coverage: the list footer and empty-state contract only; rows,
// skeletons and the empty illustration are presentation stubs.
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
  formatTimestamp: () => 'Today',
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

const row = (id: string) =>
  ({
    id,
    address: '0xa',
    chain: 'eth',
    time_at: 100,
    project_item: null,
  } as unknown as HistoryDisplayItem);

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
