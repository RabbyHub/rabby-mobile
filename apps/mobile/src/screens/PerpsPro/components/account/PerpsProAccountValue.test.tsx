import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { PixelRatio, StyleSheet } from 'react-native';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

import { PerpsProAccountValue } from './PerpsProAccountValue';
import { resolveAccountValueFit } from './perpsProAccountValueSizing';

const style = {
  fontFamily: 'SF Pro Rounded',
  fontWeight: '700' as const,
  fontVariant: ['tabular-nums' as const],
  fontSize: 18,
  lineHeight: 22,
};
const value = '$194,262,049.75';
const props = { style, value, testID: 'amount' };
const amountStyle = () =>
  StyleSheet.flatten(screen.getByTestId('amount').props.style);
const measureNode = () =>
  screen.getByTestId('amount-measure', { includeHiddenElements: true });
const layout = (width: number, height = 22) =>
  fireEvent(screen.getByTestId('amount-slot'), 'layout', {
    nativeEvent: { layout: { width, height, x: 0, y: 0 } },
  });
const measure = (width: number) =>
  fireEvent(measureNode(), 'textLayout', {
    nativeEvent: { lines: [{ width }] },
  });

// Unit/component: native layout widths are supplied explicitly. Device text
// shaping/painting is not simulated by these tests.
describe('Account amount width fitting', () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });
  afterEach(() => jest.restoreAllMocks());

  it('fits the reported amount at 17pt and preserves the complete string and line box', () => {
    render(<PerpsProAccountValue {...props} />);
    layout(154);
    measure(154.749);
    expect(StyleSheet.flatten(measureNode().props.style).fontSize).toBe(17);
    expect(amountStyle().opacity).toBe(0);
    measure(146.152);

    expect(screen.getByTestId('amount').props.children).toBe(value);
    expect(amountStyle()).toMatchObject({ ...style, fontSize: 17, opacity: 1 });
    expect(screen.getByTestId('amount').props.numberOfLines).toBe(1);
    expect(
      screen.getByTestId('amount').props.adjustsFontSizeToFit,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByTestId('amount-slot').props.style),
    ).toEqual({
      alignSelf: 'stretch',
      height: 22,
    });
    expect(
      screen.queryByTestId('amount-measure', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('does not shrink a fitting PNL when native height is rounded below 22', () => {
    render(
      <PerpsProAccountValue {...props} value="-$43,853,130.52" align="right" />,
    );
    layout(154, 21.999999);
    measure(151.058);
    expect(amountStyle()).toMatchObject({
      fontSize: 18,
      opacity: 1,
      textAlign: 'right',
    });
  });

  it('verifies a proportional estimate and steps down when the actual candidate overflows', () => {
    render(<PerpsProAccountValue {...props} />);
    layout(154);
    measure(170);
    expect(StyleSheet.flatten(measureNode().props.style).fontSize).toBe(16);
    measure(154.1);
    expect(StyleSheet.flatten(measureNode().props.style).fontSize).toBe(15);
    measure(145);
    expect(amountStyle()).toMatchObject({ fontSize: 15, opacity: 1 });
  });

  it('checks the next larger size so a conservative estimate does not over-shrink', () => {
    render(<PerpsProAccountValue {...props} />);
    layout(154);
    measure(170);
    measure(150); // 16pt fits, but 17pt must also be checked.
    expect(StyleSheet.flatten(measureNode().props.style).fontSize).toBe(17);
    measure(153);
    expect(amountStyle()).toMatchObject({ fontSize: 17, opacity: 1 });
  });

  it('restores the largest verified font after width changes without remeasuring known sizes', () => {
    render(<PerpsProAccountValue {...props} />);
    layout(154);
    measure(154.749);
    measure(146.152);
    layout(170.5);
    expect(amountStyle()).toMatchObject({ fontSize: 18, opacity: 1 });
    layout(154);
    expect(amountStyle()).toMatchObject({ fontSize: 17, opacity: 1 });
    expect(
      screen.queryByTestId('amount-measure', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('keeps tick updates with the same tabular shape visible without native remeasurement', () => {
    const view = render(<PerpsProAccountValue {...props} />);
    layout(154);
    measure(154.749);
    measure(146.152);
    view.rerender(<PerpsProAccountValue {...props} value="$888,111,999.00" />);
    expect(screen.getByTestId('amount').props.children).toBe('$888,111,999.00');
    expect(amountStyle()).toMatchObject({ fontSize: 17, opacity: 1 });
    expect(
      screen.queryByTestId('amount-measure', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('remeasures a shorter shape and ignores late callbacks, including A -> B -> A', () => {
    const view = render(<PerpsProAccountValue {...props} />);
    layout(154);
    const stale = measureNode().props.onTextLayout;
    measure(154.749);
    measure(146.152);
    view.rerender(<PerpsProAccountValue {...props} value="$1.00" />);
    measure(45);
    expect(amountStyle()).toMatchObject({ fontSize: 18, opacity: 1 });
    view.rerender(<PerpsProAccountValue {...props} />);
    act(() => stale({ nativeEvent: { lines: [{ width: 10 }] } }));
    expect(amountStyle().opacity).toBe(0);
    measure(154.749);
    measure(146.152);
    expect(amountStyle()).toMatchObject({ fontSize: 17, opacity: 1 });
  });

  it('invalidates measurements for a new font and does not normalize proportional digits', () => {
    const view = render(<PerpsProAccountValue {...props} />);
    layout(154);
    measure(154.749);
    measure(146.152);
    const proportional = {
      ...style,
      fontVariant: [],
      fontFamily: 'Other font',
    };
    view.rerender(<PerpsProAccountValue {...props} style={proportional} />);
    expect(amountStyle().opacity).toBe(0);
    measure(100);
    view.rerender(
      <PerpsProAccountValue
        {...props}
        style={proportional}
        value="$888,111,999.00"
      />,
    );
    expect(amountStyle().opacity).toBe(0);
  });

  it('ignores invalid measurements and zero-width layouts, then recovers', () => {
    render(<PerpsProAccountValue {...props} />);
    layout(0);
    measure(Number.NaN);
    measure(0);
    expect(amountStyle().opacity).toBe(0);
    measure(154.749);
    expect(amountStyle().opacity).toBe(0);
    layout(170.5);
    expect(amountStyle().opacity).toBe(1);
  });

  it('excludes the measuring copy from layout, touch and accessibility', () => {
    render(<PerpsProAccountValue {...props} />);
    const measuring = measureNode();
    expect(measuring.props.accessible).toBe(false);
    expect(StyleSheet.flatten(measuring.props.style)).toMatchObject({
      fontVariant: ['tabular-nums'],
      fontFamily: style.fontFamily,
      fontWeight: '700',
      fontSize: 18,
    });
    expect(
      StyleSheet.flatten(measuring.props.style).lineHeight,
    ).toBeUndefined();
    const container = measuring.parent?.parent;
    expect(container?.props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(StyleSheet.flatten(container?.props.style)).toMatchObject({
      position: 'absolute',
      opacity: 0,
    });
  });
});

describe('Account amount font resolution', () => {
  it.each([1, 2, 3])(
    'uses the actual pixel boundary at density %i',
    density => {
      expect(resolveAccountValueFit(154, { 18: 154 }, density)).toMatchObject({
        fontSize: 18,
        ready: true,
      });
      expect(
        resolveAccountValueFit(154, { 18: 154.001 }, density),
      ).toMatchObject({ measureFontSize: 17, ready: false });
    },
  );

  it('can continue below the old 18pt/14pt/12pt cutoffs', () => {
    expect(resolveAccountValueFit(134, { 18: 300, 8: 135, 7: 118 }, 3)).toEqual(
      { fontSize: 7, measureFontSize: null, ready: true },
    );
  });

  it('never treats an overflowing minimum as a completed fit', () => {
    expect(resolveAccountValueFit(1, { 18: 300, 1: 16 }, 3)).toMatchObject({
      ready: false,
      measureFontSize: null,
    });
  });
});
