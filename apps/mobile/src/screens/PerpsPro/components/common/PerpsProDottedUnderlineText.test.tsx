import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';

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

import { PerpsProDottedUnderlineText } from './PerpsProDottedUnderlineText';

describe('PerpsProDottedUnderlineText', () => {
  it('draws a hairline inside a non-zero canvas using the measured text width', () => {
    const view = render(
      <PerpsProDottedUnderlineText style={{ color: '#9a9ca9', fontSize: 12 }}>
        PNL (USDC)
      </PerpsProDottedUnderlineText>,
    );

    expect(view.UNSAFE_queryByType(Svg)).toBeNull();

    fireEvent(screen.getByText('PNL (USDC)'), 'layout', {
      nativeEvent: {
        layout: { height: 16, width: 61.5, x: 0, y: 0 },
      },
    });

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-dotted-underline').props.style,
      ),
    ).toMatchObject({
      height: 1,
      width: 61.5,
    });
    expect(view.UNSAFE_getByType(Svg).props).toMatchObject({
      height: '100%',
      width: '100%',
    });
    expect(view.UNSAFE_getByType(Line).props).toMatchObject({
      stroke: '#9a9ca9',
      strokeDasharray: [StyleSheet.hairlineWidth, StyleSheet.hairlineWidth * 2],
      strokeWidth: StyleSheet.hairlineWidth,
      x2: '100%',
      y1: 1 - StyleSheet.hairlineWidth / 2,
      y2: 1 - StyleSheet.hairlineWidth / 2,
    });
  });

  it('only exposes button semantics when an explanation action is supplied', () => {
    const onPress = jest.fn();
    const view = render(
      <PerpsProDottedUnderlineText
        accessibilityLabel="PNL explanation"
        onPress={onPress}>
        PNL
      </PerpsProDottedUnderlineText>,
    );

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);

    view.rerender(
      <PerpsProDottedUnderlineText>Funding</PerpsProDottedUnderlineText>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
