import type {
  SpotMeta,
  UserHistoricalOrders,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable } from 'react-native';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/assets2024/icons/history/IconRightArrowCC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View, { testID: 'history-arrow' });
});

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

    fireEvent.press(screen.getByLabelText('page.perps.historyDetail.feeTitle'));
    expect(onShowFeeExplanation).toHaveBeenCalledWith(false);
    expect(screen.queryByText('Perp')).toBeNull();

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
      expect(screen.getByTestId(icon).props).toMatchObject({
        height: 18,
        width: 18,
      });
      expect(screen.getByText('USDT')).toBeTruthy();
      view.unmount();
    },
  );

  it('renders Funding asset, side, pair symbol and signed amount', () => {
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
    expect(screen.getByText('page.perps.pro.history.long')).toBeTruthy();
    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.queryByText(/perpetual/i)).toBeNull();
    expect(screen.getByText('-0.03')).toBeTruthy();
  });
});

describe('PerpsProHistoryRowView Orders', () => {
  it('renders Limit Amount and Filled in quote', () => {
    render(
      <PerpsProHistoryRowView
        amountUnit="quote"
        onShowFeeExplanation={jest.fn()}
        row={mapPerpsProOrderHistoryFact(makeOrder('Limit'), {})}
      />,
    );

    expect(screen.getByText('15.00/20.00')).toBeTruthy();
    expect(screen.getByText('-- / 0.2000')).toBeTruthy();
    expect(screen.queryByTestId('history-arrow')).toBeNull();
    expect(screen.UNSAFE_queryAllByType(Pressable)).toHaveLength(0);
    expect(screen.queryByText('Perp')).toBeNull();
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
    expect(screen.getByText('-- / page.perps.pro.history.market')).toBeTruthy();
    expect(screen.getByText('page.perps.pro.history.true')).toBeTruthy();
  });

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
    render(
      <PerpsProHistoryRowView
        amountUnit="base"
        onShowFeeExplanation={jest.fn()}
        row={mapPerpsProOrderHistoryFact(
          {
            ...makeOrder('Limit'),
            order: { ...makeOrder('Limit').order, coin: 'xyz:AAPL' },
          },
          {},
        )}
      />,
    );

    expect(screen.getByText('xyz')).toBeTruthy();
    expect(screen.queryByText('Perp')).toBeNull();
  });
});
