import { Text } from '@/components/Typography';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useShowPerpsPortfolioBreakdown } from './PerpsPortfolioBreakdownExplanation';

const mockGetBreakdownValues = jest.fn(() => ({
  perpsValue: 39.96,
  secondaryValue: 221.6,
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/perps/usePerpsPortfolioBreakdown', () => ({
  usePerpsPortfolioBreakdown: () => ({
    breakdownMode: 'unified',
    getBreakdownValues: mockGetBreakdownValues,
    hasNonPerpsAssets: true,
  }),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/number', () => ({
  formatUsdValue: (value: number) => `$${value.toFixed(2)}`,
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

const PortfolioBreakdownTrigger = () => {
  const { hasNonPerpsAssets, showPortfolioBreakdown } =
    useShowPerpsPortfolioBreakdown();
  return (
    <Pressable
      onPress={() => showPortfolioBreakdown(261.56)}
      testID="open-portfolio-breakdown">
      <Text>{String(hasNonPerpsAssets)}</Text>
    </Pressable>
  );
};

const TipsPopupStateProbe = () => {
  const { hideTipsPopup, state } = useTipsPopup();
  return (
    <View>
      <Pressable onPress={hideTipsPopup} testID="close-portfolio-breakdown" />
      <Text testID="portfolio-breakdown-state">
        {state.visible
          ? `${state.title}:${state.bgType}:${state.buttonType}:${
              state.owner
            }:${String(state.enablePanDownToClose)}`
          : 'closed'}
      </Text>
      {state.visible && React.isValidElement(state.desc) ? state.desc : null}
    </View>
  );
};

describe('Perps Portfolio Value breakdown integration', () => {
  it('publishes the shared Simple/Pro breakdown through the real Tips atom', () => {
    render(
      <View>
        <PortfolioBreakdownTrigger />
        <TipsPopupStateProbe />
      </View>,
    );

    fireEvent.press(screen.getByTestId('open-portfolio-breakdown'));

    expect(mockGetBreakdownValues).toHaveBeenCalledWith(261.56);
    expect(screen.getByTestId('portfolio-breakdown-state')).toHaveTextContent(
      'page.perps.PerpsCard.unifiedAccount:bg0:hyperliquid:perps-portfolio-breakdown:true',
    );
    expect(
      screen.getByText('page.perps.PerpsCard.unifiedAccountDesc'),
    ).toBeTruthy();
    expect(
      screen.getByText('page.perps.PerpsCard.breakdownPerps'),
    ).toBeTruthy();
    expect(
      screen.getByText('page.perps.PerpsCard.breakdownOtherAssets'),
    ).toBeTruthy();
    expect(screen.getByText('$39.96')).toBeTruthy();
    expect(screen.getByText('$221.60')).toBeTruthy();

    fireEvent.press(screen.getByTestId('close-portfolio-breakdown'));
  });
});
