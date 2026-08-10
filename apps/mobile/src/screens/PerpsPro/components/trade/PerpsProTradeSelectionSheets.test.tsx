import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/perps/PerpsProOptionCheck.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProOrderTypeHelp.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        { children, ...props }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          children,
          testID: 'selection-sheet',
        });
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: () => '#192945' });
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.positions.cross': 'Cross',
        'page.perps.pro.trade.conditional': 'Conditional',
        'page.perps.pro.trade.conditionalDescription':
          'Place a limit or market order when target price is reached',
        'page.perps.pro.trade.crossDescription': 'Cross description',
        'page.perps.pro.trade.isolated': 'Isolated',
        'page.perps.pro.trade.isolatedDescription': 'Isolated description',
        'page.perps.pro.trade.limit': 'Limit',
        'page.perps.pro.trade.limitDescription': 'Limit description',
        'page.perps.pro.trade.marginMode': 'Margin Mode',
        'page.perps.pro.trade.market': 'Market',
        'page.perps.pro.trade.marketDescription': 'Market description',
        'page.perps.pro.trade.orderType': 'Order Type',
      }[key] ?? key),
  }),
}));

import { PerpsProMarginModeSheet } from './PerpsProMarginModeSheet';
import { PerpsProOrderTypeSheet } from './PerpsProOrderTypeSheet';

describe('Perps Pro trade selection sheets', () => {
  it('matches the 372px Margin Mode card contract', () => {
    const onSelect = jest.fn();
    render(
      <PerpsProMarginModeSheet
        marketName="BTC"
        onClose={jest.fn()}
        onSelect={onSelect}
        selected="cross"
        visible
      />,
    );

    expect(screen.getByTestId('selection-sheet').props.snapPoints).toEqual([
      372,
    ]);
    expect(screen.getByText('BTC Margin Mode')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('Cross').props.style),
    ).toMatchObject({ fontSize: 14, lineHeight: 18 });
    expect(
      StyleSheet.flatten(screen.getByText('Cross description').props.style),
    ).toMatchObject({ fontSize: 12, lineHeight: 16 });
    expect(screen.getByTestId('perps-pro-margin-mode-selected')).toBeTruthy();

    fireEvent.press(screen.getByTestId('perps-pro-margin-mode-isolated'));
    expect(onSelect).toHaveBeenCalledWith('isolated');
  });

  it('matches the 326px Order Type icon-list contract', () => {
    const onSelect = jest.fn();
    render(
      <PerpsProOrderTypeSheet
        onClose={jest.fn()}
        onSelect={onSelect}
        selected="limit"
        visible
      />,
    );

    expect(screen.getByTestId('selection-sheet').props.snapPoints).toEqual([
      326,
    ]);
    expect(
      StyleSheet.flatten(screen.getByText('Order Type').props.style),
    ).toMatchObject({ fontSize: 16, lineHeight: 20 });
    expect(
      screen.getByTestId('perps-pro-order-type-help', {
        includeHiddenElements: true,
      }).props,
    ).toMatchObject({ height: 16, width: 16 });
    expect(screen.getByTestId('perps-pro-order-type-selected')).toBeTruthy();
    expect(screen.getByText('Limit description')).toBeTruthy();
    expect(screen.getByText('Market description')).toBeTruthy();
    expect(
      screen.getByText(
        'Place a limit or market order when target price is reached',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId('perps-pro-order-type-market'));
    expect(onSelect).toHaveBeenCalledWith('market');
  });
});
