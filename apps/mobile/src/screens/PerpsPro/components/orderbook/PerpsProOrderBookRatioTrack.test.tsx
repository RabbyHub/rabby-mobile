import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';

import { PerpsProOrderBookRatioTrack } from './PerpsProOrderBookRatioTrack';
import { usePerpsProOrderBookPercentAnimation } from './usePerpsProOrderBookPercentAnimation';

// Component/unit geometry coverage: keep real Animated.Value/interpolation and
// the component's styles. The percent hook supplies deterministic progress;
// this does not prove native clipping, pixel rounding, or resize-frame timing.
jest.mock('./usePerpsProOrderBookPercentAnimation', () => ({
  usePerpsProOrderBookPercentAnimation: jest.fn(),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => ({
    styles: getStyle({
      colors2024: {
        'green-default': '#00aa00',
        'red-default': '#aa0000',
        'neutral-line': '#cccccc',
      },
    }),
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

const mockUsePercent = jest.mocked(usePerpsProOrderBookPercentAnimation);
const TRACK = 'perps-pro-order-book-ratio-track';
const BUY = 'perps-pro-order-book-buy-ratio-track';
const SELL = 'perps-pro-order-book-sell-ratio-track';
const BUY_CLIP = 'perps-pro-order-book-buy-ratio-clip';
const SELL_CLIP = 'perps-pro-order-book-sell-ratio-clip';
const initialProps = {
  animationIdentity: 'BTC:5:null|both|6|content',
  buyPercent: 50,
  hasValue: true,
};

function measure(width: number) {
  fireEvent(screen.getByTestId(TRACK), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 4 } },
  });
}

function styleOf(testID: string): ViewStyle {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

function translation(style: ViewStyle): number {
  expect(style.transform).toEqual([{ translateX: expect.any(Number) }]);
  return (style.transform as [{ translateX: number }])[0].translateX;
}

function expectStatic(percent: number) {
  expect(screen.queryByTestId(BUY_CLIP)).toBeNull();
  expect(screen.queryByTestId(SELL_CLIP)).toBeNull();
  expect(styleOf(BUY)).toMatchObject({
    flexBasis: 0,
    flexGrow: percent,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  });
  expect(styleOf(SELL)).toMatchObject({
    flexBasis: 0,
    flexGrow: 100 - percent,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  });
  expect(styleOf(BUY).transform).toBeUndefined();
  expect(styleOf(SELL).transform).toBeUndefined();
}

function expectGeometry(width: number, percent: number) {
  const buyClip = styleOf(BUY_CLIP);
  const sellClip = styleOf(SELL_CLIP);
  const buy = styleOf(BUY);
  const sell = styleOf(SELL);
  for (const style of [buyClip, sellClip, buy, sell]) {
    expect(style).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
    expect(style.flexGrow).toBeUndefined();
    expect(style.flexBasis).toBeUndefined();
    expect(style.width).toBeUndefined();
  }
  expect(buyClip.overflow).toBe('hidden');
  expect(sellClip.overflow).toBe('hidden');
  expect(screen.getByTestId(BUY_CLIP).props.collapsable).toBe(false);
  expect(screen.getByTestId(SELL_CLIP).props.collapsable).toBe(false);

  const buyClipX = translation(buyClip);
  const sellClipX = translation(sellClip);
  const buyBackgroundX = buyClipX + translation(buy);
  const sellBackgroundX = sellClipX + translation(sell);
  expect(buyBackgroundX).toBeCloseTo(0, 8);
  expect(sellBackgroundX).toBeCloseTo(0, 8);

  // Intersect each translated clip with its countertranslated background and
  // the track. Derive the visible edges from rendered styles, not a mock.
  const buyLeft = Math.max(0, buyClipX, buyBackgroundX);
  const buyRight = Math.min(width, buyClipX + width, buyBackgroundX + width);
  const sellLeft = Math.max(0, sellClipX, sellBackgroundX);
  const sellRight = Math.min(width, sellClipX + width, sellBackgroundX + width);
  const expectedBuyWidth = ((width - 2) * percent) / 100;
  const expectedSellWidth = width - 2 - expectedBuyWidth;
  expect(buyLeft).toBeCloseTo(0, 8);
  expect(buyRight).toBeCloseTo(expectedBuyWidth, 8);
  expect(sellLeft).toBeCloseTo(expectedBuyWidth + 2, 8);
  expect(sellRight).toBeCloseTo(width, 8);
  expect(sellLeft - buyRight).toBeCloseTo(2, 8);
  expect(sellRight - sellLeft).toBeCloseTo(expectedSellWidth, 8);

  expect(buy.borderTopLeftRadius).toBeCloseTo(Math.min(2, expectedBuyWidth), 8);
  expect(buy.borderBottomLeftRadius).toBeCloseTo(
    Math.min(2, expectedBuyWidth),
    8,
  );
  expect(sell.borderTopRightRadius).toBeCloseTo(
    Math.min(2, expectedSellWidth),
    8,
  );
  expect(sell.borderBottomRightRadius).toBeCloseTo(
    Math.min(2, expectedSellWidth),
    8,
  );
  expect(buy.borderTopRightRadius).toBeUndefined();
  expect(buy.borderBottomRightRadius).toBeUndefined();
  expect(sell.borderTopLeftRadius).toBeUndefined();
  expect(sell.borderBottomLeftRadius).toBeUndefined();
  expect(buy.backgroundColor).toBe('#00aa00');
  expect(sell.backgroundColor).toBe('#aa0000');
}

describe('PerpsProOrderBookRatioTrack unit geometry', () => {
  let progress: Animated.Value;

  beforeEach(() => {
    progress = new Animated.Value(50);
    mockUsePercent.mockReset();
    mockUsePercent.mockReturnValue(progress);
  });

  it('shows the original static ratio before measurement and keeps touch passthrough', () => {
    render(<PerpsProOrderBookRatioTrack {...initialProps} buyPercent={25} />);

    expectStatic(25);
    expect(screen.getByTestId(TRACK).props.pointerEvents).toBe('none');
    expect(styleOf(TRACK)).toMatchObject({
      flex: 1,
      flexDirection: 'row',
      gap: 2,
      height: 4,
      overflow: 'hidden',
    });
    expect(mockUsePercent).toHaveBeenLastCalledWith({
      animationIdentity: `${initialProps.animationIdentity}|width:0`,
      hasValue: true,
      targetPercent: 25,
      valueIdentity: 'buy-ratio',
    });
  });

  it.each([
    [50, 0],
    [50, 100],
    [50, 0.0001],
    [50, 99.9999],
    [50, 4],
    [50, 100 / 24],
    [50, 5],
    [50, 95],
    [50, 100 - 100 / 24],
    [50, 96],
    [50.25, 12.45],
    [37.7142857143, 44.77],
    [2.25, 0],
    [2.25, 50],
    [2.25, 100],
    [3.5, 33.33],
    [4, 25],
    [4.125, 50],
    [136, 50],
  ])(
    'preserves the reveal geometry at width %s and percent %s',
    (width, percent) => {
      progress.setValue(percent);
      render(
        <PerpsProOrderBookRatioTrack {...initialProps} buyPercent={percent} />,
      );
      measure(width);

      expectGeometry(width, percent);
    },
  );

  it('uses real shared animated progress rather than the latest target to move both sides', () => {
    progress.setValue(25);
    render(<PerpsProOrderBookRatioTrack {...initialProps} buyPercent={90} />);
    measure(50.25);
    expectGeometry(50.25, 25);

    act(() => progress.setValue(75));
    expectGeometry(50.25, 75);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    'ignores invalid measured width %s before and after a valid measurement',
    width => {
      render(<PerpsProOrderBookRatioTrack {...initialProps} />);
      measure(width);
      expectStatic(50);

      measure(50.25);
      expectGeometry(50.25, 50);
      measure(width);
      expectGeometry(50.25, 50);
      expect(mockUsePercent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          animationIdentity: `${initialProps.animationIdentity}|width:50.25`,
        }),
      );
    },
  );

  it.each([0, 1.5, 2])('uses static fallback for measured width %s', width => {
    render(<PerpsProOrderBookRatioTrack {...initialProps} />);
    measure(50);
    expectGeometry(50, 50);
    measure(width);
    expectStatic(50);
  });

  it('rebuilds geometry and changes animation identity after a new width is delivered', () => {
    render(<PerpsProOrderBookRatioTrack {...initialProps} />);
    measure(50);
    expectGeometry(50, 50);
    measure(37.7142857143);
    expectGeometry(37.7142857143, 50);
    expect(mockUsePercent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        animationIdentity: `${initialProps.animationIdentity}|width:37.7142857143`,
      }),
    );
  });

  it('shows only the neutral empty track without value, including after measurement', () => {
    const { rerender } = render(
      <PerpsProOrderBookRatioTrack {...initialProps} hasValue={false} />,
    );
    measure(50);
    expect(screen.queryByTestId(BUY)).toBeNull();
    expect(screen.queryByTestId(SELL)).toBeNull();
    expect(screen.queryByTestId(BUY_CLIP)).toBeNull();
    expect(screen.queryByTestId(SELL_CLIP)).toBeNull();
    const track = screen.getByTestId(TRACK);
    expect(track.children).toHaveLength(1);
    const empty = track.children[0];
    if (typeof empty === 'string') {
      throw new Error('Expected an empty track View');
    }
    expect(StyleSheet.flatten(empty.props.style)).toEqual({
      backgroundColor: '#cccccc',
      borderRadius: 2,
      flex: 1,
    });
    expect(mockUsePercent).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasValue: false }),
    );

    rerender(<PerpsProOrderBookRatioTrack {...initialProps} />);
    expectGeometry(50, 50);
    rerender(
      <PerpsProOrderBookRatioTrack {...initialProps} hasValue={false} />,
    );
    expect(screen.queryByTestId(BUY_CLIP)).toBeNull();
    expect(screen.queryByTestId(SELL_CLIP)).toBeNull();
  });

  it.each([
    [-1, 0],
    [101, 100],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])(
    'normalizes target %s to %s before measurement and animation',
    (input, percent) => {
      render(
        <PerpsProOrderBookRatioTrack {...initialProps} buyPercent={input} />,
      );
      expectStatic(percent);
      expect(mockUsePercent).toHaveBeenLastCalledWith(
        expect.objectContaining({ targetPercent: percent }),
      );
    },
  );
});
