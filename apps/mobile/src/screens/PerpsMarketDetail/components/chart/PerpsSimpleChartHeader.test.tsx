import React from 'react';
import { render } from '@testing-library/react-native';

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
import { simpleSelectionTime } from './model';

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
  style: 'candle',
};
describe('Simple header presentation (component unit)', () => {
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
    const date = view.getByText(simpleSelectionTime(selection.time));
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
