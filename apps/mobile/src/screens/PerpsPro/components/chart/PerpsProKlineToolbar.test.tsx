import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { PERPS_PRO_CANDLE_INTERVAL_OPTIONS } from '@/hooks/perps/candles/interval';

import { PerpsProKlineToolbar } from './PerpsProKlineToolbar';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

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

describe('PerpsProKlineToolbar', () => {
  it('renders the Simple interval set with the design typography', () => {
    const onSelect = jest.fn();
    render(<PerpsProKlineToolbar interval="15m" onSelect={onSelect} />);

    expect(screen.getAllByRole('radio')).toHaveLength(
      PERPS_PRO_CANDLE_INTERVAL_OPTIONS.length,
    );
    ['1m', '4h', '12h', '1D', '3D', '1W', '1M'].forEach(label => {
      expect(screen.getByText(label)).toBeTruthy();
    });
    expect(
      screen.getByTestId('perps-pro-kline-interval-15m').props
        .accessibilityState,
    ).toMatchObject({ checked: true, disabled: false });
    expect(StyleSheet.flatten(screen.getByText('15m').props.style)).toEqual(
      expect.objectContaining({
        color: 'neutral-title-1',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 16,
      }),
    );
    expect(StyleSheet.flatten(screen.getByText('5m').props.style)).toEqual(
      expect.objectContaining({
        color: 'neutral-secondary',
        fontWeight: '500',
      }),
    );

    fireEvent.press(screen.getByTestId('perps-pro-kline-interval-3d'));
    expect(onSelect).toHaveBeenCalledWith('3d');
  });

  it('blocks selection while the shared preference is hydrating', () => {
    const onSelect = jest.fn();
    render(
      <PerpsProKlineToolbar disabled interval="15m" onSelect={onSelect} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-kline-interval-1h'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
