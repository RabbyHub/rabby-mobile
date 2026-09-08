import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

jest.mock('@/assets2024/icons/perps/IconHistoryCC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/home/pending.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, { ...props, testID: 'pending-ring' });
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.account.account': 'Account',
        'page.perps.pro.account.history': 'Account history',
        'page.perps.pro.account.openOrders': 'Open Orders',
        'page.perps.pro.account.positions': 'Positions',
      }[key] || key),
  }),
}));

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: { Text: ReactNative.Text, View: ReactNative.View },
    cancelAnimation: jest.fn(),
    Easing: { bezier: jest.fn(() => 'ease-out') },
    ReduceMotion: { System: 'system' },
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (target: number) => target,
  };
});

import { PerpsProInfoTabs } from './PerpsProInfoTabs';

const indicatorPosition = { value: 0 } as SharedValue<number>;

describe('PerpsProInfoTabs', () => {
  beforeEach(() => {
    indicatorPosition.value = 0;
  });

  it('keeps counted tab labels on one line', () => {
    render(
      <PerpsProInfoTabs
        activeTab="openOrders"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={123}
        pendingFundingCount={0}
        positionsCount={45}
      />,
    );

    expect(screen.getByText('Positions (45)').props.numberOfLines).toBe(1);
    expect(screen.getByText('Open Orders (123)').props.numberOfLines).toBe(1);
    expect(screen.getAllByRole('tab').map(tab => tab.props.testID)).toEqual([
      'perps-pro-info-tab-positions',
      'perps-pro-info-tab-openOrders',
      'perps-pro-info-tab-account',
    ]);
  });

  it('derives visible label emphasis from the same UI position as the indicator', () => {
    indicatorPosition.value = 0.49;
    const view = render(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={0}
        pendingFundingCount={0}
        positionsCount={0}
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByText('Positions (0)').props.style),
    ).toMatchObject({ color: 'neutral-title-1', fontWeight: '500' });
    expect(
      StyleSheet.flatten(screen.getByText('Open Orders (0)').props.style),
    ).toMatchObject({ color: 'neutral-secondary', fontWeight: '400' });

    indicatorPosition.value = 0.51;
    view.rerender(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={0}
        pendingFundingCount={0}
        positionsCount={0}
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByText('Positions (0)').props.style),
    ).toMatchObject({ color: 'neutral-secondary', fontWeight: '400' });
    expect(
      StyleSheet.flatten(screen.getByText('Open Orders (0)').props.style),
    ).toMatchObject({ color: 'neutral-title-1', fontWeight: '500' });
    expect(
      StyleSheet.flatten(screen.getByText('Account').props.style),
    ).toMatchObject({ color: 'neutral-secondary', fontWeight: '400' });
    expect(
      screen.getByTestId('perps-pro-info-tab-account').props.accessibilityState,
    ).toEqual({ selected: true });

    indicatorPosition.value = 2;
    view.rerender(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={0}
        pendingFundingCount={0}
        positionsCount={0}
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByText('Open Orders (0)').props.style),
    ).toMatchObject({ color: 'neutral-secondary', fontWeight: '400' });
    expect(
      StyleSheet.flatten(screen.getByText('Account').props.style),
    ).toMatchObject({ color: 'neutral-title-1', fontWeight: '500' });
  });

  it('only dispatches the History action when the SDK capability is enabled', () => {
    const onHistoryPress = jest.fn();
    const view = render(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled={false}
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={onHistoryPress}
        openOrdersCount={0}
        pendingFundingCount={0}
        positionsCount={0}
      />,
    );
    fireEvent.press(screen.getByTestId('perps-pro-history'));
    expect(onHistoryPress).not.toHaveBeenCalled();

    view.rerender(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={onHistoryPress}
        openOrdersCount={0}
        pendingFundingCount={0}
        positionsCount={0}
      />,
    );
    fireEvent.press(screen.getByTestId('perps-pro-history'));
    expect(onHistoryPress).toHaveBeenCalledTimes(1);
    expect(onHistoryPress).toHaveBeenLastCalledWith(false);
  });

  it('hides the count for one pending operation and shows it above one', () => {
    const view = render(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={0}
        pendingFundingCount={1}
        positionsCount={0}
      />,
    );
    expect(screen.getByTestId('perps-pro-history-pending')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-history-pending-count')).toBeNull();

    view.rerender(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={0}
        pendingFundingCount={3}
        positionsCount={0}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-history-pending-count').props.children,
    ).toBe(3);
    view.unmount();
  });

  it('reports pending funding when History is opened', () => {
    const onHistoryPress = jest.fn();
    render(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={onHistoryPress}
        openOrdersCount={0}
        pendingFundingCount={1}
        positionsCount={0}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-history'));
    expect(onHistoryPress).toHaveBeenCalledWith(true);
  });

  it('renders one indicator and interpolates its measured tab frame', () => {
    indicatorPosition.value = 0.5;
    render(
      <PerpsProInfoTabs
        activeTab="positions"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={0}
        pendingFundingCount={0}
        positionsCount={0}
      />,
    );

    act(() => {
      fireEvent(screen.getByTestId('perps-pro-info-tab-positions'), 'layout', {
        nativeEvent: { layout: { height: 44, width: 80, x: 15, y: 0 } },
      });
      fireEvent(screen.getByTestId('perps-pro-info-tab-openOrders'), 'layout', {
        nativeEvent: { layout: { height: 44, width: 100, x: 107, y: 0 } },
      });
      fireEvent(screen.getByTestId('perps-pro-info-tab-account'), 'layout', {
        nativeEvent: { layout: { height: 44, width: 70, x: 219, y: 0 } },
      });
    });

    const indicators = screen.getAllByTestId('perps-pro-info-tab-indicator', {
      includeHiddenElements: true,
    });
    expect(indicators).toHaveLength(1);
    expect(StyleSheet.flatten(indicators[0].props.style)).toMatchObject({
      backgroundColor: 'neutral-title-1',
      bottom: 0,
      height: 2,
      left: 61,
      opacity: 1,
      width: 90,
    });
  });

  it('uses stable active typography for localized label measurement', () => {
    render(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={0}
        pendingFundingCount={0}
        positionsCount={0}
      />,
    );

    const accountLabels = screen.getAllByText('Account', {
      includeHiddenElements: true,
    });
    expect(accountLabels).toHaveLength(2);
    expect(
      accountLabels.map(label => StyleSheet.flatten(label.props.style)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontWeight: '500', opacity: 0 }),
        expect.objectContaining({ position: 'absolute' }),
      ]),
    );
  });

  it('commits localized frame changes as the current indicator geometry', () => {
    indicatorPosition.value = 1.5;
    render(
      <PerpsProInfoTabs
        activeTab="account"
        historyEnabled
        indicatorPosition={indicatorPosition}
        onChange={jest.fn()}
        onHistoryPress={jest.fn()}
        openOrdersCount={0}
        pendingFundingCount={0}
        positionsCount={0}
      />,
    );
    const accountTab = screen.getByTestId('perps-pro-info-tab-account');

    act(() => {
      fireEvent(screen.getByTestId('perps-pro-info-tab-positions'), 'layout', {
        nativeEvent: { layout: { height: 44, width: 80, x: 15, y: 0 } },
      });
      fireEvent(screen.getByTestId('perps-pro-info-tab-openOrders'), 'layout', {
        nativeEvent: { layout: { height: 44, width: 100, x: 107, y: 0 } },
      });
      fireEvent(accountTab, 'layout', {
        nativeEvent: { layout: { height: 44, width: 70, x: 219, y: 0 } },
      });
    });
    const indicator = screen.getByTestId('perps-pro-info-tab-indicator', {
      includeHiddenElements: true,
    });
    expect(StyleSheet.flatten(indicator.props.style)).toMatchObject({
      left: 163,
      width: 85,
    });

    act(() => {
      fireEvent(accountTab, 'layout', {
        nativeEvent: { layout: { height: 44, width: 180, x: 249, y: 0 } },
      });
    });
    expect(StyleSheet.flatten(indicator.props.style)).toMatchObject({
      left: 178,
      width: 140,
    });
  });
});
