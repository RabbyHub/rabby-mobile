import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets/icons/header/back-cc.svg', () => () => null);
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
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
jest.mock('./PerpsProCloseMarketTag', () => ({
  PerpsProCloseMarketTag: () => null,
}));

import type { PerpsPositionViewModel } from '../../model/position';
import {
  PerpsProPositionTpSlHeader,
  PerpsProPositionTpSlPageHeader,
} from './PerpsProPositionTpSlHeader';

const position = {
  coin: 'BTC',
  direction: 'long',
  entryPrice: '100',
  leverage: 10,
  liquidationPrice: '80',
} as PerpsPositionViewModel;
const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '99',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: 'xyz',
  szDecimals: 3,
};

describe('PerpsProPositionTpSlHeader', () => {
  it('uses the live Mark and the Figma vertical summary geometry', () => {
    render(
      <PerpsProPositionTpSlHeader
        markPrice="101.25"
        market={market}
        position={position}
        variant="main"
      />,
    );

    const header = screen.getByTestId('perps-pro-position-tpsl-header-main');
    expect(StyleSheet.flatten(header.props.style)).toMatchObject({
      height: 146,
      paddingHorizontal: 15,
      paddingTop: 8,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-pair-main').props.style,
      ),
    ).toMatchObject({ marginTop: 12 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-metrics-main').props.style,
      ),
    ).toMatchObject({ gap: 8, marginTop: 16 });
    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.getByText('100.00')).toBeTruthy();
    expect(screen.getByText('101.25')).toBeTruthy();
    expect(screen.queryByText('99.00')).toBeNull();
    expect(screen.getByText('80.00')).toBeTruthy();
  });

  it('renders a 56px subpage header and delegates back', () => {
    const onBack = jest.fn();
    render(
      <PerpsProPositionTpSlPageHeader onBack={onBack} title="Add TP/SL" />,
    );

    expect(screen.getByText('Add TP/SL')).toBeTruthy();
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the pair information in the no-order header', () => {
    render(
      <PerpsProPositionTpSlHeader
        markPrice="101.25"
        market={market}
        position={position}
        variant="empty"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-header-empty').props.style,
      ),
    ).toMatchObject({
      height: 146,
      paddingHorizontal: 15,
      paddingTop: 8,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-metrics-empty').props.style,
      ),
    ).toMatchObject({ gap: 8, marginTop: 16 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-pair-empty').props.style,
      ),
    ).toMatchObject({ marginTop: 12 });
    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.getByText('long 10x')).toBeTruthy();
  });
});
