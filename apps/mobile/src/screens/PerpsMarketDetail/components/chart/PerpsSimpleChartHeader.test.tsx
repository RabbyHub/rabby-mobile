import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/up.svg',
  () => () =>
    require('react').createElement(require('react-native').View, {
      testID: 'up',
    }),
);
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/down.svg',
  () => () =>
    require('react').createElement(require('react-native').View, {
      testID: 'down',
    }),
);
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/metric.svg',
  () => () => null,
);

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@rneui/themed', () => ({
  Skeleton: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'skeleton',
    }),
}));
jest.mock(
  '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear',
  () => ({ LoadingLinear: () => null }),
);
jest.mock('@/screens/Home/utils/price', () => ({
  formatUsdValueKMB: () => '$105.01M',
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = require('@/constant/theme').ThemeColors2024.dark;
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PerpsSimpleChartHeader } from './PerpsSimpleChartHeader';

const props: React.ComponentProps<typeof PerpsSimpleChartHeader> = {
  active: true,
  markPrice: 0.084561,
  decimals: 6,
  prevDayPx: 0.085057,
  range: '1D',
  rangeReference: null,
  referenceLoading: false,
  marketLoading: false,
  openInterest: 105010000,
  volume: 100,
  selection: null,
  selectionTimeText: "Tue 14 Nov '23 22:13",
  style: 'candle',
};
describe('Simple header presentation (component unit)', () => {
  it('uses the verified first daily open for a short 1D history, including loading and failure', () => {
    const view = render(
      <PerpsSimpleChartHeader
        {...props}
        shortHistory
        markPrice={120}
        decimals={2}
        prevDayPx={110}
        rangeReference={100}
      />,
    );
    expect(view.getByText('+$20.00 (+20.00%) 24h')).toBeTruthy();
    view.rerender(
      <PerpsSimpleChartHeader
        {...props}
        shortHistory
        rangeReference={null}
        referenceLoading
      />,
    );
    expect(view.getByTestId('skeleton')).toBeTruthy();
    view.rerender(
      <PerpsSimpleChartHeader {...props} shortHistory rangeReference={null} />,
    );
    expect(view.getByText('— 24h')).toBeTruthy();
  });
  it('fixes all OLHC columns and uses one measured tabular font size across selection moves', () => {
    const selection = {
      time: 1700000000,
      open: 99.99,
      low: 98.88,
      high: 100,
      close: 100,
    };
    const view = render(
      <PerpsSimpleChartHeader
        {...props}
        decimals={2}
        selection={selection}
        ohlcMeasureText="$888.88"
      />,
    );
    const measured = view.getByText('$888.88', { includeHiddenElements: true });
    fireEvent(measured, 'textLayout', {
      nativeEvent: { lines: [{ width: 112 }] },
    });
    const value = view.getByText('$99.99');
    let column = value.parent;
    while (column && column.type !== 'View') column = column.parent;
    expect(StyleSheet.flatten(column!.props.style)).toMatchObject({
      flex: 1,
      minWidth: 0,
    });
    fireEvent(column!, 'layout', { nativeEvent: { layout: { width: 64 } } });
    const font = StyleSheet.flatten(view.getByText('$99.99').props.style);
    expect(font).toMatchObject({
      fontSize: 8,
      lineHeight: 18,
      fontVariant: ['tabular-nums'],
    });
    expect(
      view.getByText('page.perpsDetail.simpleChart.open').props.numberOfLines,
    ).toBe(1);
    view.rerender(
      <PerpsSimpleChartHeader
        {...props}
        decimals={2}
        selection={{ ...selection, open: 100.0, low: 99.99 }}
        ohlcMeasureText="$888.88"
      />,
    );
    for (const text of view.getAllByText('$100.00')) {
      expect(StyleSheet.flatten(text.props.style)).toEqual(font);
      expect(text.props.numberOfLines).toBe(1);
      expect(text.props.adjustsFontSizeToFit).toBeUndefined();
    }
    const time = view.getByText(props.selectionTimeText!);
    expect(StyleSheet.flatten(time.props.style)).toMatchObject({
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400',
    });
  });
  it('returns to the live mark after holding an Area candle and shares the change row with its date', () => {
    const selection = {
      time: 1700000000,
      open: 90,
      close: 99,
      high: 105,
      low: 85,
    };
    const view = render(
      <PerpsSimpleChartHeader
        {...props}
        markPrice={120}
        prevDayPx={100}
        decimals={2}
        style="area"
        selection={selection}
      />,
    );
    expect(view.getByText('$99.00')).toBeTruthy();
    const change = view.getByText('+$9.00 (+10.00%)');
    const date = view.getByText(props.selectionTimeText!);
    // The two texts share a layout row; this does not assert native pixel geometry.
    const layoutParent = (node: typeof change) => {
      let parent = node.parent;
      while (parent && parent.type !== 'View') parent = parent.parent;
      return parent;
    };
    expect(
      layoutParent(change) !== null &&
        layoutParent(change) === layoutParent(date),
    ).toBe(true);
    view.rerender(
      <PerpsSimpleChartHeader
        {...props}
        markPrice={125}
        prevDayPx={100}
        decimals={2}
        style="area"
      />,
    );
    expect(view.getByText('$125.00')).toBeTruthy();
    expect(view.getByText('+$25.00 (+25.00%) 24h')).toBeTruthy();
    view.rerender(
      <PerpsSimpleChartHeader {...props} markPrice={0} prevDayPx={100} />,
    );
    expect(view.queryByTestId('up')).toBeNull();
    expect(view.queryByTestId('down')).toBeNull();
  });
  it('shows the full signed dollar change and daily suffix in one scalable text', () => {
    const view = render(<PerpsSimpleChartHeader {...props} />);
    const change = view.getByText('-$0.000496 (-0.58%) 24h');
    expect(change.props.numberOfLines).toBe(1);
    expect(change.props.adjustsFontSizeToFit).toBe(true);
  });
  it('loads missing fields separately and leaves unavailable data neutral after loading', () => {
    const view = render(
      <PerpsSimpleChartHeader
        {...props}
        markPrice={null}
        prevDayPx={NaN}
        marketLoading
      />,
    );
    expect(view.getAllByTestId('skeleton')).toHaveLength(2);
    view.rerender(
      <PerpsSimpleChartHeader {...props} prevDayPx={NaN} marketLoading />,
    );
    expect(view.getAllByTestId('skeleton')).toHaveLength(1);
    expect(view.getByText('$0.084561')).toBeTruthy();
    view.rerender(<PerpsSimpleChartHeader {...props} prevDayPx={NaN} />);
    expect(view.queryByTestId('skeleton')).toBeNull();
    expect(view.queryByTestId('up')).toBeNull();
    expect(view.queryByTestId('down')).toBeNull();
    expect(view.getByText('— 24h')).toBeTruthy();
    view.rerender(
      <PerpsSimpleChartHeader
        {...props}
        active={false}
        markPrice={null}
        prevDayPx={NaN}
        marketLoading
      />,
    );
    expect(view.queryByTestId('skeleton')).toBeNull();
  });
  it('uses the selected range reference, candle OHLC on hold, and 24h for manual periods', () => {
    const view = render(
      <PerpsSimpleChartHeader
        {...props}
        decimals={2}
        markPrice={120}
        range="1W"
        rangeReference={100}
      />,
    );
    expect(view.getByText('+$20.00 (+20.00%) 1W')).toBeTruthy();
    const selection = {
      time: 1700000000,
      open: 90,
      high: 105,
      low: 85,
      close: 99,
    };
    view.rerender(
      <PerpsSimpleChartHeader
        {...props}
        decimals={2}
        markPrice={120}
        range="1W"
        rangeReference={100}
        selection={selection}
      />,
    );
    expect(view.getByText('+$9.00 (+10.00%)')).toBeTruthy();
    view.rerender(
      <PerpsSimpleChartHeader
        {...props}
        decimals={2}
        markPrice={120}
        range={null}
        prevDayPx={100}
      />,
    );
    expect(view.getByText('+$20.00 (+20.00%) 24h')).toBeTruthy();
  });
});
