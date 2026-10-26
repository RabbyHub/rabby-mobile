import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/CustomSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    CustomSkeleton: (props: object) => ReactModule.createElement(View, props),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => ({
    styles: getStyle({ colors2024: { 'neutral-info': '#c5c5cf' } }),
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

import { PerpsProMarketPair } from './PerpsProMarketPair';

describe('PerpsProMarketPair', () => {
  it('keeps routing interactive while replacing unresolved metadata with a field skeleton', () => {
    const onPress = jest.fn();
    const view = render(
      <PerpsProMarketPair
        metadataReady={false}
        onPress={onPress}
        testID="market-pair"
        value="BTC"
      />,
    );

    expect(screen.queryByText('BTC')).toBeNull();
    const skeleton = screen.getByTestId('market-pair-skeleton');
    expect(StyleSheet.flatten(skeleton.props.style)).toMatchObject({
      backgroundColor: '#c5c5cf',
      borderRadius: 2,
    });
    expect(skeleton.props).toMatchObject({ height: 14, width: 52 });
    fireEvent.press(screen.getByTestId('market-pair'));
    expect(onPress).toHaveBeenCalledTimes(1);

    view.rerender(
      <PerpsProMarketPair
        metadataReady
        onPress={onPress}
        testID="market-pair"
        value="BTCUSDE"
      />,
    );
    expect(screen.getByText('BTCUSDE')).toBeTruthy();
    expect(screen.queryByTestId('market-pair-skeleton')).toBeNull();
  });
});
