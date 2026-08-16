import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/assets2024/singleHome/empty-token.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/singleHome/empty-token-dark.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, isLight: true, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./PerpsProHistoryRow', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHistoryRowView: ({ row }: { row: { key: string } }) =>
      ReactModule.createElement(View, { testID: `history-row-${row.key}` }),
  };
});

import { PerpsProHistoryList } from './PerpsProHistoryList';
import type { PerpsProHistoryTabState } from '../types';

const makeState = (
  overrides: Partial<PerpsProHistoryTabState> = {},
): PerpsProHistoryTabState => ({
  hasEarlier: false,
  loadingEarlier: false,
  refreshing: false,
  rows: [],
  status: 'empty',
  ...overrides,
});

describe('PerpsProHistoryList', () => {
  it('renders the approved local skeleton and per-tab empty state', () => {
    const view = render(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState({ status: 'loading' })}
        tab="orders"
      />,
    );
    expect(screen.getByLabelText('Loading history')).toBeTruthy();

    view.rerender(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState()}
        tab="transaction"
      />,
    );
    expect(screen.getByText('page.perps.pro.history.noHistory')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-history-empty-light')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByText('page.perps.pro.history.noHistory').props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        color: 'neutral-info',
        fontFamily: 'SF Pro',
        fontSize: 14,
        lineHeight: 18,
        marginTop: 12,
      }),
    );
  });

  it('renders initial error Retry', () => {
    const onRetry = jest.fn();
    render(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        onRetry={onRetry}
        state={makeState({ status: 'error' })}
        tab="orders"
      />,
    );
    fireEvent.press(screen.getByText('page.perps.pro.common.retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the first populated row 16px below the divider', () => {
    render(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState({
          rows: [{ key: 'row-1' } as never],
          status: 'ready',
        })}
        tab="trade"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-history-list-trade').props
          .contentContainerStyle,
      ),
    ).toMatchObject({ paddingBottom: 24, paddingTop: 16 });
  });

  it('loads earlier automatically at the end and keeps Retry explicit', () => {
    const onLoadEarlier = jest.fn();
    const view = render(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={onLoadEarlier}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState({ hasEarlier: true })}
        tab="funding"
      />,
    );

    expect(screen.queryByText('page.perps.pro.history.loadEarlier')).toBeNull();
    fireEvent(
      screen.getByTestId('perps-pro-history-list-funding'),
      'endReached',
      { distanceFromEnd: 0 },
    );
    expect(onLoadEarlier).toHaveBeenCalledTimes(1);

    view.rerender(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={onLoadEarlier}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState({
          hasEarlier: true,
          loadEarlierError: 'network',
        })}
        tab="funding"
      />,
    );
    fireEvent(
      screen.getByTestId('perps-pro-history-list-funding'),
      'endReached',
      { distanceFromEnd: 0 },
    );
    expect(onLoadEarlier).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('page.perps.pro.common.retry'));
    expect(onLoadEarlier).toHaveBeenCalledTimes(2);
  });

  it('shows only the loading footer and never paginates Orders', () => {
    const onLoadEarlier = jest.fn();
    const view = render(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={onLoadEarlier}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState({ hasEarlier: true, loadingEarlier: true })}
        tab="trade"
      />,
    );

    expect(
      screen.getByLabelText('page.perps.pro.history.loadingMore').props
        .accessibilityState,
    ).toEqual({ busy: true });
    expect(screen.queryByText('page.perps.pro.history.loadEarlier')).toBeNull();

    view.rerender(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={onLoadEarlier}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState({ hasEarlier: true })}
        tab="orders"
      />,
    );
    fireEvent(
      screen.getByTestId('perps-pro-history-list-orders'),
      'endReached',
      { distanceFromEnd: 0 },
    );
    expect(onLoadEarlier).not.toHaveBeenCalled();
  });

  it('does not paginate or scroll an adjacent preview page', () => {
    const onLoadEarlier = jest.fn();
    render(
      <PerpsProHistoryList
        active={false}
        amountUnit="base"
        onLoadEarlier={onLoadEarlier}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState({ hasEarlier: true })}
        tab="trade"
      />,
    );

    const list = screen.getByTestId('perps-pro-history-list-trade');
    expect(list.props.scrollEnabled).toBe(false);
    fireEvent(list, 'endReached', { distanceFromEnd: 0 });
    expect(onLoadEarlier).not.toHaveBeenCalled();
  });
});
