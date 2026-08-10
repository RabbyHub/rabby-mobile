import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets/icons/swap/switch-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProAvailableAdd.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProAmountUnitArrow.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/common/checkbox-empty-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/common/checkbox-filled-brand.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProPrecisionCaret.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
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

jest.mock('@rneui/themed', () => ({
  Slider: (props: object) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, {
      ...props,
      testID: 'rne-slider',
    });
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.positions.cross': 'Cross',
        'page.perps.pro.trade.amount': 'Amount',
        'page.perps.pro.trade.available': 'Available',
        'page.perps.pro.trade.buyLong': 'Buy/Long',
        'page.perps.pro.trade.cost': 'Cost',
        'page.perps.pro.trade.disabledFrame': 'Disabled trade frame',
        'page.perps.pro.trade.isolated': 'Isolated',
        'page.perps.pro.trade.market': 'Market',
        'page.perps.pro.trade.max': 'Max',
        'page.perps.pro.trade.reduceOnly': 'Reduce Only',
        'page.perps.pro.trade.sellShort': 'Sell/Short',
      }[key] || key),
  }),
}));

jest.mock('../common/PerpsProDottedUnderlineText', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return {
    PerpsProDottedUnderlineText: ({ children, style }: any) =>
      ReactModule.createElement(
        Text,
        { style, testID: `dotted-${String(children)}` },
        children,
      ),
  };
});

import { PerpsProTradeSkeleton } from './PerpsProTradeSkeleton';

describe('PerpsProTradeSkeleton', () => {
  it('uses the three approved sections and centered field typography', () => {
    render(
      <PerpsProTradeSkeleton
        leverage={25}
        marginMode="isolated"
        quoteAsset="USDT"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-skeleton').props.style,
      ),
    ).toMatchObject({ gap: 16, height: 416 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-input-group').props.style,
      ),
    ).toMatchObject({ gap: 8 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-options-group').props.style,
      ),
    ).toMatchObject({ gap: 8 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-order-groups').props.style,
      ),
    ).toMatchObject({ gap: 16 });
    expect(
      StyleSheet.flatten(screen.getByText('Isolated').props.style),
    ).toMatchObject({ fontSize: 14, lineHeight: 18, textAlign: 'center' });
    expect(
      StyleSheet.flatten(screen.getByText('25x').props.style),
    ).toMatchObject({
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
    });
    expect(screen.getAllByTestId('perps-pro-trade-select-caret')).toHaveLength(
      1,
    );
  });

  it('renders the Trade-only five-point slider and amount field geometry', () => {
    render(<PerpsProTradeSkeleton quoteAsset="USDT" />);

    expect(
      screen.getAllByTestId('perps-pro-trade-amount-slider-point'),
    ).toHaveLength(5);
    expect(
      StyleSheet.flatten(screen.getByTestId('rne-slider').props.thumbStyle),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      borderColor: 'neutral-title-1',
      borderWidth: 1,
      height: 13,
      width: 13,
    });
    expect(
      StyleSheet.flatten(
        screen.getAllByTestId('perps-pro-trade-amount-slider-point')[0].props
          .style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      borderColor: 'neutral-title-1',
      borderWidth: 1,
      height: 7,
      width: 7,
    });
    expect(screen.getByLabelText('Amount(USDT)')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-trade-amount-minus')).toBeNull();
    expect(screen.queryByTestId('perps-pro-trade-amount-plus')).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-amount-unit').props.style,
      ),
    ).toMatchObject({ borderLeftWidth: 1, height: 24, width: 52 });
  });

  it('adds the Available action and dotted explanatory labels', () => {
    render(<PerpsProTradeSkeleton quoteAsset="USDT" />);

    expect(screen.getByTestId('perps-pro-trade-available-add')).toBeTruthy();
    expect(screen.getByTestId('dotted-TP/SL')).toBeTruthy();
    expect(screen.getByTestId('dotted-Reduce Only')).toBeTruthy();
    expect(screen.getAllByTestId('dotted-Cost')).toHaveLength(2);
  });
});
