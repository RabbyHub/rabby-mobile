import type {
  SpotMeta,
  UserHistoricalOrders,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { ThemeColors2024 } from '@/constant/theme';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/assets2024/icons/bridge/IconPendingCC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, { ...props, testID: 'pending-icon' });
});

jest.mock('@/assets2024/icons/bridge/IconFailedCC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, { ...props, testID: 'failed-icon' });
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { mapPerpsProOrderHistoryFact } from '../model/orderHistory';
import { buildPerpsProOrderExecutionIndex } from '../model/orderExecution';
import { mapPerpsProTradeHistoryFact } from '../model/tradeHistory';
import { mapPerpsProFundingHistoryFact } from '../model/fundingHistory';
import { mapPerpsProTransactionHistoryFact } from '../model/transactionHistory';
import { formatPerpsProOrderHistoryPrice } from './historyRowFormatters';
import { PerpsProHistoryRowView } from './PerpsProHistoryRow';

const makeOrder = (orderType: string): UserHistoricalOrders => ({
  order: {
    children: [],
    cloid: null,
    coin: 'DOGE',
    isPositionTpsl: orderType !== 'Limit',
    isTrigger: orderType !== 'Limit',
    limitPx: '0.2',
    oid: 7,
    orderType,
    origSz: '100',
    reduceOnly: orderType !== 'Limit',
    side: 'A',
    sz: '25',
    tif: 'Gtc',
    timestamp: 90,
    triggerCondition: orderType === 'Limit' ? '' : 'Price above 0.19',
    triggerPx: orderType === 'Limit' ? '0' : '0.19',
  },
  status: 'open',
  statusTimestamp: 100,
});

const stableSpotMeta: SpotMeta = {
  tokens: [
    { index: 0, name: 'USDC' },
    { index: 235, name: 'USDE' },
  ],
  universe: [{ index: 150, name: 'USDE/USDC', tokens: [235, 0] }],
};

describe('PerpsProHistoryRowView Trade, Transaction and Funding', () => {
  const onShowFeeExplanation = jest.fn();
  const fill: WsFill = {
    closedPnl: '12.5',
    coin: 'BTC',
    crossed: true,
    dir: 'Close Long',
    fee: '0.5',
    hash: '0xfill',
    oid: 8,
    px: '2000',
    side: 'A',
    startPosition: '1',
    sz: '0.25',
    tid: 9,
    time: 200,
  };

  beforeEach(() => {
    onShowFeeExplanation.mockClear();
  });

  it('keeps history cards distinct from the page surface in both themes', () => {
    expect(ThemeColors2024.light['neutral-card-1']).not.toBe(
      ThemeColors2024.light['neutral-bg-0'],
    );
    expect(ThemeColors2024.dark['neutral-card-1']).not.toBe(
      ThemeColors2024.dark['neutral-bg-0'],
    );
  });

  it('switches Trade Filled between base and quote without changing net PNL', () => {
    const row = mapPerpsProTradeHistoryFact(fill, {});
    const view = render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={onShowFeeExplanation}
        row={row}
      />,
    );
    expect(screen.getByText('0.25')).toBeTruthy();
    expect(screen.getByText('0.50')).toBeTruthy();
    expect(screen.getByText('12.00')).toBeTruthy();
    expect(screen.getByText('2,000.0')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-history-trade-200-BTC-A-9').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-card-1',
      borderRadius: 12,
      marginHorizontal: 16,
      paddingHorizontal: 12,
      paddingVertical: 16,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-history-trade-200-BTC-A-9-details').props
          .style,
      ).borderBottomWidth,
    ).toBeUndefined();

    fireEvent.press(screen.getByLabelText('page.perps.historyDetail.feeTitle'));
    expect(onShowFeeExplanation).toHaveBeenCalledWith(false);
    expect(screen.queryByText('Perp')).toBeNull();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.queryByText('page.perps.pro.history.sell')).toBeNull();
    const sideText = screen.getByLabelText('page.perps.pro.history.sell');
    expect(StyleSheet.flatten(sideText.props.style)).toMatchObject({
      color: 'neutral-InvertHighlight',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    });
    const sideTag = screen.getByTestId(
      'perps-pro-history-trade-200-BTC-A-9-side-tag',
    );
    expect(StyleSheet.flatten(sideTag?.props.style)).toMatchObject({
      backgroundColor: 'red-default',
      borderRadius: 4,
      height: 16,
      paddingHorizontal: 4,
    });
    expect(StyleSheet.flatten(sideTag.props.style).borderWidth).toBeUndefined();

    view.rerender(
      <PerpsProHistoryRowView
        amountUnit="quote"
        onShowFeeExplanation={onShowFeeExplanation}
        row={row}
      />,
    );
    expect(screen.getByText('500.00')).toBeTruthy();
    expect(screen.getByText('12.00')).toBeTruthy();
  });

  it('opens the liquidation-specific Fee explanation for liquidation fills', () => {
    const row = mapPerpsProTradeHistoryFact(
      {
        ...fill,
        liquidation: {
          liquidatedUser: '0x0000000000000000000000000000000000000001',
          markPx: '2000',
          method: 'market',
        },
      },
      {},
    );

    render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={onShowFeeExplanation}
        row={row}
      />,
    );
    fireEvent.press(screen.getByLabelText('page.perps.historyDetail.feeTitle'));

    expect(onShowFeeExplanation).toHaveBeenCalledWith(true);
  });

  it('renders Transaction Type and signed Amount without a navigation arrow', () => {
    const result = mapPerpsProTransactionHistoryFact(
      {
        delta: { type: 'deposit', usdc: '1.25' },
        hash: '0xdeposit',
        time: 300,
      },
      '0x1111111111111111111111111111111111111111',
    );
    if (!result.row) {
      throw new Error('expected a transaction row');
    }
    render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={onShowFeeExplanation}
        row={result.row}
      />,
    );
    expect(screen.getByText('page.perps.pro.history.deposit')).toBeTruthy();
    expect(screen.getByText('+1.25')).toBeTruthy();
    expect(screen.queryByTestId('history-arrow')).toBeNull();
  });

  it.each([
    ['pending', 'pending-icon'],
    ['failed', 'failed-icon'],
  ] as const)(
    'renders the %s Transaction status instead of time',
    (status, icon) => {
      const view = render(
        <PerpsProHistoryRowView
          amountUnit="base"
          onShowFeeExplanation={onShowFeeExplanation}
          row={{
            amount: '12',
            asset: 'USDT',
            direction: status === 'pending' ? 'deposit' : 'withdraw',
            hash: `0x${status}`,
            key: status,
            kind: 'transaction',
            rawType: status === 'pending' ? 'receive' : 'withdraw',
            status,
            time: 300,
          }}
        />,
      );
      expect(
        screen.getByText(`page.perps.pro.history.status.${status}`),
      ).toBeTruthy();
      expect(
        StyleSheet.flatten(
          screen.getByText(`page.perps.pro.history.status.${status}`).props
            .style,
        ),
      ).toMatchObject({
        fontFamily: 'SF Pro Rounded',
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
      });
      expect(screen.getByTestId(icon).props).toMatchObject({
        height: 18,
        width: 18,
      });
      expect(screen.getByText('USDT')).toBeTruthy();
      view.unmount();
    },
  );

  it('does not run the Pending animation while its Pager page is inactive', () => {
    const start = jest.fn();
    const stop = jest.fn();
    const loop = jest.spyOn(Animated, 'loop').mockReturnValue({
      start,
      stop,
    } as ReturnType<typeof Animated.loop>);
    const pendingRow = {
      amount: '12',
      asset: 'USDT',
      direction: 'deposit' as const,
      hash: '0xpending',
      key: 'pending',
      kind: 'transaction' as const,
      rawType: 'receive',
      status: 'pending' as const,
      time: 300,
    };
    const view = render(
      <PerpsProHistoryRowView
        active={false}
        amountUnit="base"
        onShowFeeExplanation={onShowFeeExplanation}
        row={pendingRow}
      />,
    );

    expect(loop).not.toHaveBeenCalled();
    view.rerender(
      <PerpsProHistoryRowView
        active
        amountUnit="base"
        onShowFeeExplanation={onShowFeeExplanation}
        row={pendingRow}
      />,
    );
    expect(start).toHaveBeenCalledTimes(1);

    view.rerender(
      <PerpsProHistoryRowView
        active={false}
        amountUnit="base"
        onShowFeeExplanation={onShowFeeExplanation}
        row={pendingRow}
      />,
    );
    expect(stop).toHaveBeenCalledTimes(1);
    loop.mockRestore();
  });

  it('renders Funding asset, pair symbol and four-decimal signed amount without side', () => {
    const row = mapPerpsProFundingHistoryFact(
      {
        coin: 'BTC',
        fundingRate: '0.0001',
        szi: '1',
        time: 400,
        usdc: '-0.03313285',
      },
      {},
    );
    render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={onShowFeeExplanation}
        row={row}
      />,
    );
    expect(screen.getByText('USDC')).toBeTruthy();
    expect(screen.queryByText('page.perps.pro.history.long')).toBeNull();
    expect(screen.queryByText('page.perps.pro.history.short')).toBeNull();
    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.queryByText(/perpetual/i)).toBeNull();
    expect(screen.getByText('-0.0331')).toBeTruthy();
  });
});

describe('PerpsProHistoryRowView Orders', () => {
  it.each([
    ['88', 0, '88.00'],
    ['1.1', 2, '1.10'],
    ['1.0000', 4, '1.00'],
    ['0.2000', 4, '0.20'],
    ['0.897300', 6, '0.8973'],
    [null, 4, '-'],
  ] as const)(
    'formats the Orders History price %s with a two-decimal floor',
    (value, decimals, expected) => {
      expect(formatPerpsProOrderHistoryPrice(value, decimals)).toBe(expected);
    },
  );

  it('renders Limit Amount and Filled in quote', () => {
    const row = mapPerpsProOrderHistoryFact(makeOrder('Limit'), {});
    render(
      <PerpsProHistoryRowView
        amountUnit="quote"
        onShowFeeExplanation={jest.fn()}
        row={row}
      />,
    );

    expect(screen.getByText('15.00/20.00')).toBeTruthy();
    expect(screen.getByText('-- / 0.20')).toBeTruthy();
    expect(screen.queryByTestId('history-arrow')).toBeNull();
    expect(screen.UNSAFE_queryAllByType(Pressable)).toHaveLength(0);
    expect(screen.queryByText('Perp')).toBeNull();
    expect(
      screen.queryByTestId(`perps-pro-history-order-${row.key}-source-tag`),
    ).toBeNull();
    expect(
      screen.getByTestId(`perps-pro-history-order-${row.key}-side-tag`),
    ).toBeTruthy();
  });

  it('uses the positive solid-side contract for a Buy order row', () => {
    const fact = makeOrder('Limit');
    const row = mapPerpsProOrderHistoryFact(
      { ...fact, order: { ...fact.order, side: 'B' } },
      {},
    );
    render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={jest.fn()}
        row={row}
      />,
    );

    const sideTagStyle = StyleSheet.flatten(
      screen.getByTestId(`perps-pro-history-order-${row.key}-side-tag`).props
        .style,
    );
    expect(sideTagStyle).toMatchObject({
      backgroundColor: 'green-default',
      borderRadius: 4,
      height: 16,
      paddingHorizontal: 4,
    });
    expect(sideTagStyle.borderWidth).toBeUndefined();
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('page.perps.pro.history.buy').props.style,
      ),
    ).toMatchObject({
      color: 'neutral-InvertHighlight',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    });
  });

  it('renders TP/SL Market Amount and Filled in base while Price remains Market', () => {
    render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={jest.fn()}
        row={mapPerpsProOrderHistoryFact(makeOrder('Take Profit Market'), {})}
      />,
    );

    expect(screen.getByText('75/100')).toBeTruthy();
    expect(screen.getByText('Take Profit Market')).toBeTruthy();
    expect(screen.queryByText('Market (Triggered)')).toBeNull();
    expect(screen.getByText('-- / page.perps.pro.history.market')).toBeTruthy();
    expect(screen.getByText('page.perps.pro.history.true')).toBeTruthy();
  });

  it.each([
    ['Take Profit Market', true],
    ['Take Profit Market', false],
    ['Stop Market', true],
  ] as const)(
    'keeps the authoritative %s label when isTrigger=%s',
    (orderType, isTrigger) => {
      const fact = makeOrder(orderType);
      render(
        <PerpsProHistoryRowView
          amountUnit="base"
          onShowFeeExplanation={jest.fn()}
          row={mapPerpsProOrderHistoryFact(
            {
              ...fact,
              order: { ...fact.order, isTrigger },
            },
            {},
          )}
        />,
      );

      expect(screen.getByText(orderType)).toBeTruthy();
      expect(screen.queryByText('Market (Triggered)')).toBeNull();
    },
  );

  it('keeps stablecoin base amounts at exactly two decimal places', () => {
    render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={jest.fn()}
        row={mapPerpsProOrderHistoryFact(
          {
            ...makeOrder('Limit'),
            order: {
              ...makeOrder('Limit').order,
              coin: '@150',
              origSz: '100.1234',
              sz: '25',
            },
          },
          {},
          new Map(),
          stableSpotMeta,
        )}
      />,
    );

    expect(screen.getByText('USDEUSDC')).toBeTruthy();
    expect(screen.getByText('75.12/100.12')).toBeTruthy();
  });

  it('uses complete fills for Market quote Amount and VWAP Price', () => {
    const executionIndex = buildPerpsProOrderExecutionIndex([
      {
        closedPnl: '0',
        coin: 'DOGE',
        crossed: true,
        dir: 'Sell',
        fee: '0.1',
        hash: '0x1',
        oid: 7,
        px: '0.18',
        side: 'A',
        startPosition: '100',
        sz: '25',
        tid: 1,
        time: 95,
      },
      {
        closedPnl: '0',
        coin: 'DOGE',
        crossed: true,
        dir: 'Sell',
        fee: '0.1',
        hash: '0x2',
        oid: 7,
        px: '0.2',
        side: 'A',
        startPosition: '75',
        sz: '50',
        tid: 2,
        time: 99,
      },
    ]);
    render(
      <PerpsProHistoryRowView
        amountUnit="quote"
        onShowFeeExplanation={jest.fn()}
        row={mapPerpsProOrderHistoryFact(
          makeOrder('Take Profit Market'),
          {},
          executionIndex,
        )}
      />,
    );

    expect(screen.getByText('14.50/19.33')).toBeTruthy();
    expect(
      screen.getByText('0.1933 / page.perps.pro.history.market'),
    ).toBeTruthy();
  });

  it('preserves a real HIP-3 source when market metadata is unavailable', () => {
    const row = mapPerpsProOrderHistoryFact(
      {
        ...makeOrder('Limit'),
        order: { ...makeOrder('Limit').order, coin: 'xyz:AAPL' },
      },
      {},
    );
    render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={jest.fn()}
        row={row}
      />,
    );

    expect(screen.getByText('xyz')).toBeTruthy();
    const sourceTag = screen.getByTestId(
      `perps-pro-history-order-${row.key}-source-tag`,
    );
    expect(StyleSheet.flatten(sourceTag?.props.style)).toMatchObject({
      backgroundColor: 'neutral-bg-5',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    expect(
      StyleSheet.flatten(sourceTag.props.style).borderColor,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(sourceTag.props.style).borderWidth,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByText('xyz').props.style),
    ).toMatchObject({
      color: 'neutral-foot',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(screen.queryByText('Perp')).toBeNull();
  });
});
