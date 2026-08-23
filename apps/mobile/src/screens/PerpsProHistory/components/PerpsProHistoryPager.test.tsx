import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockHideFeeTipsPopup = jest.fn();

jest.mock('@/hooks/useTipsPopup', () => ({
  useHideTipsPopup: () => mockHideFeeTipsPopup,
}));

jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ReactModule.forwardRef(
    (
      {
        children,
        ...props
      }: {
        children: React.ReactNode;
        onPageSelected?: (event: unknown) => void;
      },
      ref: React.Ref<unknown>,
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({
        setPage: mockSetPage,
        setPageWithoutAnimation: mockSetPageWithoutAnimation,
      }));
      return ReactModule.createElement(View, props, children);
    },
  );
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
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./PerpsProHistoryList', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHistoryList: ({ active, tab }: { active: boolean; tab: string }) =>
      ReactModule.createElement(View, {
        testID: `history-list-${tab}-${active ? 'active' : 'preview'}`,
      }),
  };
});

import { createPerpsProHistoryState } from '../scene/perpsProHistoryControllerState';
import {
  getPreparedPerpsProHistoryTabs,
  PerpsProHistoryPager,
} from './PerpsProHistoryPager';

describe('PerpsProHistoryPager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the current and adjacent page content mounted for a swipe', () => {
    render(
      <PerpsProHistoryPager
        activeTab="orders"
        amountUnit="base"
        onChange={jest.fn()}
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        state={createPerpsProHistoryState()}
      />,
    );

    expect(screen.getByTestId('history-list-orders-active')).toBeTruthy();
    expect(screen.getByTestId('history-list-trade-preview')).toBeTruthy();
    expect(screen.queryByTestId('history-list-funding-preview')).toBeNull();
  });

  it('commits a swipe only after PagerView selects the page', () => {
    const onChange = jest.fn();
    render(
      <PerpsProHistoryPager
        activeTab="orders"
        amountUnit="quote"
        onChange={onChange}
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        state={createPerpsProHistoryState()}
      />,
    );

    fireEvent(screen.getByTestId('perps-pro-history-pager'), 'pageSelected', {
      nativeEvent: { position: 1 },
    });

    expect(onChange).toHaveBeenCalledWith('trade');
    expect(mockHideFeeTipsPopup).toHaveBeenCalledTimes(1);
  });

  it('closes the owned Fee explanation as soon as a native swipe starts', () => {
    render(
      <PerpsProHistoryPager
        activeTab="trade"
        amountUnit="quote"
        onChange={jest.fn()}
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        state={createPerpsProHistoryState()}
      />,
    );

    fireEvent(
      screen.getByTestId('perps-pro-history-pager'),
      'pageScrollStateChanged',
      { nativeEvent: { pageScrollState: 'dragging' } },
    );

    expect(mockHideFeeTipsPopup).toHaveBeenCalledTimes(1);
  });

  it('prepares a distant tab before requesting a non-animated jump', () => {
    render(
      <PerpsProHistoryPager
        activeTab="orders"
        amountUnit="base"
        onChange={jest.fn()}
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        state={createPerpsProHistoryState()}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));
    });

    expect(screen.getByTestId('history-list-funding-preview')).toBeTruthy();
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
    expect(mockHideFeeTipsPopup).toHaveBeenCalledTimes(1);
  });

  it('bounds prepared pages to three and keeps a distant jump target ready', () => {
    expect([...getPreparedPerpsProHistoryTabs('trade', null)]).toEqual([
      'orders',
      'trade',
      'transaction',
    ]);
    expect([...getPreparedPerpsProHistoryTabs('orders', 'funding')]).toEqual([
      'orders',
      'funding',
    ]);
    expect([...getPreparedPerpsProHistoryTabs('trade', 'funding')]).toEqual([
      'trade',
      'funding',
    ]);
  });
});
