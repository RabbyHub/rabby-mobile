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

  it('measures the first line while underlining every wrapped line', () => {
    const onFirstLineLayout = jest.fn();
    const view = render(
      <PerpsProDottedUnderlineText
        multiline
        onFirstLineLayout={onFirstLineLayout}
        style={{ color: '#9a9ca9', fontSize: 12 }}>
        Precio de liquidación (USDC)
      </PerpsProDottedUnderlineText>,
    );

    const lines = [
      { ascender: 11, width: 74, x: 9, y: 0 },
      { ascender: 10, baseline: 27, width: 58, x: 25, y: 16 },
      { ascender: 12, baseline: 45, width: 42, x: 41, y: 32 },
    ];
    const expectedGeometries = lines.map(line =>
      resolvePerpsProDottedUnderlineGeometry({
        fontSize: 12,
        line,
        minimumStrokeWidth: StyleSheet.hairlineWidth,
        roundToNearestPixel: PixelRatio.roundToNearestPixel,
      }),
    );
    const canvasLeft = Math.min(
      ...expectedGeometries.map(geometry => geometry.canvasLeft),
    );
    const canvasTop = Math.min(
      ...expectedGeometries.map(geometry => geometry.canvasTop),
    );
    const canvasRight = Math.max(
      ...expectedGeometries.map(
        geometry => geometry.canvasLeft + geometry.width,
      ),
    );
    const canvasBottom = Math.max(
      ...expectedGeometries.map(
        geometry => geometry.canvasTop + geometry.canvasHeight,
      ),
    );
    const label = screen.getByText('Precio de liquidación (USDC)');
    expect(label.props.numberOfLines).toBeUndefined();
    fireEvent(label, 'textLayout', { nativeEvent: { lines } });

    expect(onFirstLineLayout).toHaveBeenCalledWith({
      lineCount: 3,
      width: 74,
      x: 9,
    });
    expect(onFirstLineLayout).toHaveBeenCalledTimes(1);
    expect(view.UNSAFE_getAllByType(Svg)).toHaveLength(1);
    const renderedLines = view.UNSAFE_getAllByType(Line);
    expect(renderedLines).toHaveLength(3);
    expectedGeometries.forEach((geometry, index) => {
      expect(renderedLines[index].props).toMatchObject({
        stroke: '#9a9ca9',
        strokeDasharray: [geometry.dotLength, geometry.dotGap],
        strokeWidth: geometry.strokeWidth,
        x1: geometry.canvasLeft - canvasLeft + geometry.lineX1,
        x2: geometry.canvasLeft - canvasLeft + geometry.lineX2,
        y1: geometry.canvasTop - canvasTop + geometry.lineY,
        y2: geometry.canvasTop - canvasTop + geometry.lineY,
      });
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-dotted-underline').props.style,
      ),
    ).toMatchObject({
      height: canvasBottom - canvasTop,
      left: canvasLeft,
      top: canvasTop,
      width: canvasRight - canvasLeft,
    });
  });

  it('keeps multiline opt-in geometry unchanged when the label fits one line', () => {
    render(
      <PerpsProDottedUnderlineText
        multiline
        style={{ color: '#9a9ca9', fontSize: 12 }}>
        Margin Ratio
      </PerpsProDottedUnderlineText>,
    );

    const line = { ascender: 11, width: 74, x: 17, y: 0 };
    const expectedGeometry = resolvePerpsProDottedUnderlineGeometry({
      fontSize: 12,
      line,
      minimumStrokeWidth: StyleSheet.hairlineWidth,
      roundToNearestPixel: PixelRatio.roundToNearestPixel,
    });
    fireEvent(screen.getByText('Margin Ratio'), 'textLayout', {
      nativeEvent: { lines: [line] },
    });

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-dotted-underline').props.style,
      ),
    ).toMatchObject({
      height: expectedGeometry.canvasHeight,
      left: expectedGeometry.canvasLeft,
      top: expectedGeometry.canvasTop,
      width: expectedGeometry.width,
    });
    expect(screen.UNSAFE_getAllByType(Svg)).toHaveLength(1);
    expect(screen.UNSAFE_getAllByType(Line)).toHaveLength(1);
  });

  it('removes stale wrapped underlines after text reflows', () => {
    const view = render(
      <PerpsProDottedUnderlineText multiline style={{ color: '#9a9ca9' }}>
        Precio de liquidación (USDC)
      </PerpsProDottedUnderlineText>,
    );
    const label = screen.getByText('Precio de liquidación (USDC)');
    const threeLines = [
      { ascender: 11, width: 74, x: 9, y: 0 },
      { ascender: 11, width: 58, x: 25, y: 16 },
      { ascender: 11, width: 42, x: 41, y: 32 },
    ];

    fireEvent(label, 'textLayout', { nativeEvent: { lines: threeLines } });
    expect(view.UNSAFE_getAllByType(Line)).toHaveLength(3);

    fireEvent(label, 'textLayout', {
      nativeEvent: { lines: [threeLines[0]] },
    });
    expect(view.UNSAFE_getAllByType(Line)).toHaveLength(1);

    fireEvent(label, 'textLayout', {
      nativeEvent: { lines: threeLines.slice(0, 2) },
    });
    expect(view.UNSAFE_getAllByType(Line)).toHaveLength(2);
  });

  it('keeps default consumers bound to first-line geometry', () => {
    render(
      <PerpsProDottedUnderlineText style={{ color: '#9a9ca9', fontSize: 12 }}>
        Funding (1h) / Countdown
      </PerpsProDottedUnderlineText>,
    );

    const lines = [
      { ascender: 11, width: 91, x: 5, y: 0 },
      { ascender: 11, width: 37, x: 59, y: 16 },
    ];
    const expectedGeometry = resolvePerpsProDottedUnderlineGeometry({
      fontSize: 12,
      line: lines[0],
      minimumStrokeWidth: StyleSheet.hairlineWidth,
      roundToNearestPixel: PixelRatio.roundToNearestPixel,
    });
    fireEvent(screen.getByText('Funding (1h) / Countdown'), 'textLayout', {
      nativeEvent: { lines },
    });

    expect(screen.UNSAFE_getAllByType(Line)).toHaveLength(1);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-dotted-underline').props.style,
      ),
    ).toMatchObject({
      height: expectedGeometry.canvasHeight,
      left: expectedGeometry.canvasLeft,
      top: expectedGeometry.canvasTop,
      width: expectedGeometry.width,
    });
  });
});
