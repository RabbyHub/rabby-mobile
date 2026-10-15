import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

let mockTranslations: Record<string, string> = {};
let mockTransComponents: Record<
  string,
  React.ReactElement<{ style?: StyleProp<TextStyle> }>
> = {};

jest.mock('@/assets2024/icons/common/rabby-wallet.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View, { testID: 'rabby-fee-icon' });
});

jest.mock('@/assets2024/icons/perps/IconHyper.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View, { testID: 'hyper-fee-icon' });
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  Trans: ({
    components,
    i18nKey,
  }: {
    components: typeof mockTransComponents;
    i18nKey: string;
  }) => {
    mockTransComponents = components;
    return i18nKey;
  },
  useTranslation: () => ({
    t: (key: string) => mockTranslations[key] ?? key,
  }),
}));

import { PerpsTradeFeeExplanationContent } from './PerpsTradeFeeExplanation';

const rabbyFeeRate = '0.02%';

describe('PerpsTradeFeeExplanationContent', () => {
  beforeEach(() => {
    mockTransComponents = {};
    mockTranslations = {};
  });

  it('keeps the default emphasis on its inherited font family', () => {
    render(
      <PerpsTradeFeeExplanationContent
        rabbyFeeRate={rabbyFeeRate}
        isLiquidation={false}
      />,
    );

    expect(StyleSheet.flatten(mockTransComponents['1'].props.style)).toEqual(
      expect.objectContaining({
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
      }),
    );
    expect(
      StyleSheet.flatten(mockTransComponents['1'].props.style)?.fontFamily,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(mockTransComponents['2'].props.style)?.fontFamily,
    ).toBeUndefined();
  });

  it('opts Pro emphasis into the explicit SF Pro Rounded family', () => {
    render(
      <PerpsTradeFeeExplanationContent
        rabbyFeeRate={rabbyFeeRate}
        isLiquidation={false}
        variant="pro"
      />,
    );

    expect(StyleSheet.flatten(mockTransComponents['1'].props.style)).toEqual(
      expect.objectContaining({
        fontFamily: 'SF Pro Rounded',
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
      }),
    );
    expect(StyleSheet.flatten(mockTransComponents['2'].props.style)).toEqual(
      expect.objectContaining({
        fontFamily: 'SF Pro Rounded',
      }),
    );
  });

  it.each([
    ['default', '0.02%'],
    ['default', '0.04%'],
    ['pro', '0.02%'],
    ['pro', '0.04%'],
  ] as const)(
    'keeps the venue rate fixed with no promotion for %s / %s',
    (variant, rate) => {
      render(
        <PerpsTradeFeeExplanationContent
          rabbyFeeRate={rate}
          isLiquidation={false}
          variant={variant}
        />,
      );

      expect(screen.getByText('page.perps.historyDetail.feeDesc')).toBeTruthy();
      expect(
        screen.getByText('page.perps.historyDetail.feeHyperliquid'),
      ).toBeTruthy();
      expect(screen.getByText('0.045%')).toBeTruthy();
      expect(
        screen.getByText('page.perps.historyDetail.feeRabby'),
      ).toBeTruthy();
      expect(screen.getAllByText(rate)).toHaveLength(1);
      expect(screen.queryByText('0.00%')).toBeNull();
      expect(screen.queryByText('-')).toBeNull();
      expect(
        StyleSheet.flatten(screen.getByText(rate).props.style)
          .textDecorationLine,
      ).toBeUndefined();
      expect(
        screen.queryByText('page.perps.historyDetail.feeRabbyDiscount'),
      ).toBeNull();
    },
  );

  it('omits the Rabby builder fee for liquidation fills', () => {
    render(
      <PerpsTradeFeeExplanationContent
        rabbyFeeRate={rabbyFeeRate}
        isLiquidation
      />,
    );

    expect(screen.getByText('0.045%')).toBeTruthy();
    expect(screen.queryByTestId('rabby-fee-icon')).toBeNull();
    expect(screen.queryByText('0.02%')).toBeNull();
    expect(screen.queryByText('0.04%')).toBeNull();
  });

  it('keeps the rate within the right-aligned remaining row width', () => {
    render(
      <PerpsTradeFeeExplanationContent
        rabbyFeeRate={rabbyFeeRate}
        isLiquidation={false}
      />,
    );

    expect(screen.getByTestId('perps-trade-fee-rabby-left')).toHaveStyle({
      flexShrink: 0,
    });
    expect(screen.getByTestId('perps-trade-fee-rabby-right')).toHaveStyle({
      alignItems: 'flex-end',
      flex: 1,
      marginLeft: 12,
      minWidth: 0,
    });

    expect(screen.queryByTestId('perps-trade-fee-rabby-discount')).toBeNull();
  });
});
