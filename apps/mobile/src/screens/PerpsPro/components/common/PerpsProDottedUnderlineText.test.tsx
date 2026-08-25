import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { PixelRatio, StyleSheet } from 'react-native';
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
import { resolvePerpsProDottedUnderlineGeometry } from './perpsProDottedUnderlineGeometry';

describe('PerpsProDottedUnderlineText', () => {
  it('draws the measured label with the approved thickness and offset', () => {
    const view = render(
      <PerpsProDottedUnderlineText style={{ color: '#9a9ca9', fontSize: 12 }}>
        PNL (USDC)
      </PerpsProDottedUnderlineText>,
    );

    expect(view.UNSAFE_queryByType(Svg)).toBeNull();

    const line = { ascender: 11, width: 61.5, y: 0 };
    const expectedGeometry = resolvePerpsProDottedUnderlineGeometry({
      fontSize: 12,
      line,
      minimumStrokeWidth: StyleSheet.hairlineWidth,
      roundToNearestPixel: PixelRatio.roundToNearestPixel,
    });
    fireEvent(screen.getByText('PNL (USDC)'), 'textLayout', {
      nativeEvent: {
        lines: [line],
      },
    });

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-dotted-underline').props.style,
      ),
    ).toMatchObject({
      height: expectedGeometry.canvasHeight,
      top: expectedGeometry.canvasTop,
      width: expectedGeometry.width,
    });
    expect(view.UNSAFE_getByType(Svg).props).toMatchObject({
      height: '100%',
      width: '100%',
    });
    expect(view.UNSAFE_getByType(Line).props).toMatchObject({
      stroke: '#9a9ca9',
      strokeDasharray: [expectedGeometry.dotLength, expectedGeometry.dotGap],
      strokeWidth: expectedGeometry.strokeWidth,
      x1: expectedGeometry.lineX1,
      x2: expectedGeometry.lineX2,
      y1: expectedGeometry.lineY,
      y2: expectedGeometry.lineY,
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

  it('keeps bounded width by default and opts field labels into natural width', () => {
    const view = render(
      <PerpsProDottedUnderlineText testID="label">
        Funding (1h) / Countdown
      </PerpsProDottedUnderlineText>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('label').props.style)).toEqual(
      expect.objectContaining({ maxWidth: '100%' }),
    );

    view.rerender(
      <PerpsProDottedUnderlineText allowNaturalWidth testID="label">
        Funding (1h) / Countdown
      </PerpsProDottedUnderlineText>,
    );
    const naturalStyle = StyleSheet.flatten(
      screen.getByTestId('label').props.style,
    );
    expect(naturalStyle).toEqual(expect.objectContaining({ flexShrink: 0 }));
    expect(naturalStyle.maxWidth).toBeUndefined();
    expect(
      screen.getByText('Funding (1h) / Countdown').props.numberOfLines,
    ).toBe(1);
  });
});
