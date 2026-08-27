import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { PERPS_PRO_CANDLE_INTERVAL_OPTIONS } from '@/hooks/perps/candles/interval';

import {
  PERPS_PRO_KLINE_RESET_SLOT_WIDTH,
  PerpsProKlineToolbar,
} from './PerpsProKlineToolbar';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/assets2024/icons/bridge/IconRefreshCC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: Record<string, unknown>) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'perps-pro-kline-reset-icon',
    });
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      },
    );
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('PerpsProKlineToolbar', () => {
  it('renders all approved intervals and emphasizes the selection', () => {
    const onSelect = jest.fn();
    const onResetPriceScale = jest.fn();
    render(
      <PerpsProKlineToolbar
        interval="15m"
        onResetPriceScale={onResetPriceScale}
        onSelect={onSelect}
        showPriceScaleReset
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(
      PERPS_PRO_CANDLE_INTERVAL_OPTIONS.length,
    );
    expect(screen.queryByText('component.kline.time')).toBeNull();
    expect(screen.getAllByRole('radio')[0].props.testID).toBe(
      'perps-pro-kline-interval-1m',
    );
    expect(
      screen.getByTestId('perps-pro-kline-interval-15m').props
        .accessibilityState,
    ).toMatchObject({ checked: true, disabled: false });
    expect(
      screen
        .getByText('15m')
        .props.style.some(
          (style: { fontWeight?: string }) => style?.fontWeight === '700',
        ),
    ).toBe(true);
    expect(
      StyleSheet.flatten(screen.getByText('15m').props.style),
    ).toMatchObject({
      fontSize: 12,
      lineHeight: 16,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-kline-interval-15m').props.style,
      ),
    ).toMatchObject({ minWidth: 40 });

    fireEvent.press(screen.getByTestId('perps-pro-kline-interval-1M'));
    expect(onSelect).toHaveBeenCalledWith('1M');

    expect(
      within(
        screen.getByTestId('perps-pro-kline-interval-scroll'),
      ).queryByTestId('perps-pro-kline-reset-price-scale'),
    ).toBeNull();
    fireEvent.press(screen.getByTestId('perps-pro-kline-reset-price-scale'));
    expect(onResetPriceScale).toHaveBeenCalledTimes(1);
  });

  it('keeps the reset slot stable while hiding the unused control', () => {
    render(
      <PerpsProKlineToolbar
        interval="15m"
        onResetPriceScale={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    expect(
      screen.queryByTestId('perps-pro-kline-reset-price-scale'),
    ).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-kline-reset-price-scale-slot').props
          .style,
      ),
    ).toMatchObject({ width: PERPS_PRO_KLINE_RESET_SLOT_WIDTH });
  });

  it('renders uppercase long-period labels and emits canonical values', () => {
    const onSelect = jest.fn();
    render(
      <PerpsProKlineToolbar
        interval="1h"
        onResetPriceScale={jest.fn()}
        onSelect={onSelect}
      />,
    );

    ['1H', '4H', '8H', '12H', '1D', '1W', '1M'].forEach(label => {
      expect(screen.getByText(label)).toBeTruthy();
    });
    ['1h', '4h', '8h', '12h', '1d', '1w'].forEach(label => {
      expect(screen.queryByText(label)).toBeNull();
    });
    expect(
      screen
        .getByText('1H')
        .props.style.some(
          (style: { fontWeight?: string }) => style?.fontWeight === '700',
        ),
    ).toBe(true);

    fireEvent.press(screen.getByTestId('perps-pro-kline-interval-1w'));
    expect(onSelect).toHaveBeenCalledWith('1w');
  });

  it('blocks selection while the shared preference is hydrating', () => {
    const onSelect = jest.fn();
    render(
      <PerpsProKlineToolbar
        disabled
        interval="15m"
        onResetPriceScale={jest.fn()}
        onSelect={onSelect}
        showPriceScaleReset
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-kline-interval-1h'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-kline-reset-price-scale').props
        .accessibilityState,
    ).toEqual({ disabled: true });
  });
});
