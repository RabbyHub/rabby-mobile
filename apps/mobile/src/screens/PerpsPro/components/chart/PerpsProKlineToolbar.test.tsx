import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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
    return { styles: getStyle({ colors2024 }) };
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
    render(<PerpsProKlineToolbar interval="15m" onSelect={onSelect} />);

    expect(screen.getAllByRole('radio')).toHaveLength(
      PERPS_PRO_CANDLE_INTERVAL_OPTIONS.length,
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

    fireEvent.press(screen.getByTestId('perps-pro-kline-interval-1M'));
    expect(onSelect).toHaveBeenCalledWith('1M');
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
