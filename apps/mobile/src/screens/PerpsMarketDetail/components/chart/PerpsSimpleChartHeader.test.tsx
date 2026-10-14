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

const mockTrade = { identity: 'DOGE', trade: null as null | { price: string } };
jest.mock('@/hooks/perps/subscriptions/usePerpsLatestTrade', () => ({
  usePerpsLatestTrade: () => mockTrade,
}));
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
  coin: 'DOGE',
  active: true,
  candleClose: 0.084561,
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
  beforeEach(() => {
    mockTrade.trade = null;
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
        candleClose={null}
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
        candleClose={null}
        prevDayPx={NaN}
        marketLoading
      />,
    );
    expect(view.queryByTestId('skeleton')).toBeNull();
  });
  it('uses the selected range reference, candle OHLC on hold, and 24h for manual periods', () => {
    mockTrade.trade = { price: '120' };
    const view = render(
      <PerpsSimpleChartHeader
        {...props}
        decimals={2}
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
        range={null}
        prevDayPx={100}
      />,
    );
    expect(view.getByText('+$20.00 (+20.00%) 24h')).toBeTruthy();
  });
});
