import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const mockBottomSheetFlatListProps = jest.fn();
const mockShowTradeFeeExplanation = jest.fn();
const mockUseShowPerpsTradeFeeExplanation = jest.fn(
  () => mockShowTradeFeeExplanation,
);
let mockIsLight = true;

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { FlatList } = require('react-native');
  return {
    BottomSheetFlatList: (props: object) => {
      mockBottomSheetFlatListProps(props);
      return ReactModule.createElement(FlatList, props);
    },
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      isLight: mockIsLight,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@/screens/PerpsShared/components/PerpsTradeFeeExplanation', () => ({
  useShowPerpsTradeFeeExplanation: (options?: object) =>
    mockUseShowPerpsTradeFeeExplanation(options),
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
import { PERPS_PRO_HISTORY_FEE_TIPS_OWNER } from '../constants';
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
  beforeEach(() => {
    mockBottomSheetFlatListProps.mockClear();
    mockShowTradeFeeExplanation.mockClear();
    mockUseShowPerpsTradeFeeExplanation.mockClear();
    mockIsLight = true;
  });

  it('explicitly opts the Pro History fee explanation into Pro typography', () => {
    render(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState()}
        tab="trade"
      />,
    );

    expect(mockUseShowPerpsTradeFeeExplanation).toHaveBeenCalledWith({
      owner: PERPS_PRO_HISTORY_FEE_TIPS_OWNER,
      variant: 'pro',
    });
  });

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
    const skeletonCard = screen
      .UNSAFE_getAllByType(View)
      .find(
        node =>
          StyleSheet.flatten(node.props.style)?.backgroundColor ===
          'neutral-card-1',
      );
    expect(StyleSheet.flatten(skeletonCard?.props.style)).toMatchObject({
      backgroundColor: 'neutral-card-1',
      borderRadius: 12,
      marginHorizontal: 16,
      paddingHorizontal: 12,
      paddingVertical: 16,
    });

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
    const lightIllustration = screen.getByTestId(
      'perps-pro-history-empty-illustration',
    );
    expect(lightIllustration.props.source).toEqual(
      expect.objectContaining({
        testUri: expect.stringContaining(
          'assets2024/icons/perps/PerpsProHistoryEmpty.png',
        ),
      }),
    );
    expect(lightIllustration.props.source.testUri).not.toContain(
      'singleHome/empty-token',
    );
    expect(StyleSheet.flatten(lightIllustration.props.style)).toEqual({
      height: 126,
      width: 163,
    });
    expect(
      StyleSheet.flatten(
        screen.getByText('page.perps.pro.history.noHistory').props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        color: 'neutral-info',
        fontFamily: 'SF Pro Rounded',
        fontSize: 16,
        lineHeight: 20,
        marginTop: 12,
      }),
    );

    mockIsLight = false;
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
    expect(
      screen.getByTestId('perps-pro-history-empty-illustration').props.source,
    ).toEqual(lightIllustration.props.source);
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

  it('starts the first card at the Pager-owned 12px content gap', () => {
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
    ).toMatchObject({ paddingBottom: 24 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-history-list-trade').props
          .contentContainerStyle,
      ).paddingTop,
    ).toBeUndefined();
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

    const loadingIndicator = screen.getByLabelText(
      'page.perps.pro.history.loadingMore',
    );
    expect(loadingIndicator.props.accessibilityState).toEqual({ busy: true });
    expect(loadingIndicator.props.color).toBe('neutral-body');
    expect(loadingIndicator.props.size).toBe('small');
    expect(StyleSheet.flatten(loadingIndicator.props.style)).toMatchObject({
      paddingBottom: 10,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-history-loading-footer').props.style,
      ),
    ).toMatchObject({
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      width: '100%',
    });
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

  it('uses the shared platform refresh indicator appearance', () => {
    render(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        state={makeState()}
        tab="trade"
      />,
    );

    const refreshControl = screen.getByTestId('perps-pro-history-list-trade')
      .props.refreshControl;
    expect(refreshControl.props.colors).toBeUndefined();
    expect(refreshControl.props.tintColor).toBeUndefined();
  });

  it('uses the Bottom Sheet scroll host without changing list behavior', () => {
    render(
      <PerpsProHistoryList
        amountUnit="base"
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        onRetry={jest.fn()}
        scrollHost="bottomSheet"
        state={makeState()}
        tab="trade"
      />,
    );

    expect(mockBottomSheetFlatListProps).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetFlatListProps.mock.calls[0][0]).toMatchObject({
      initialNumToRender: 10,
      nestedScrollEnabled: true,
      scrollEnabled: true,
      testID: 'perps-pro-history-list-trade',
    });
  });
});
